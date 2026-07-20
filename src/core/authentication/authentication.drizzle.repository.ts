import { Injectable } from '@nestjs/common';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID, type PublicOf, ServerException } from '~/common';
import {
  authIdentities,
  authPasswordResetTokens,
  authSessions,
  DrizzleService,
  userGlobalRoles,
  users,
} from '~/core/drizzle';
import { type AuthenticationRepository } from './authentication.repository';
import { type LoginInput } from './dto';
import { type Session } from './session/session.dto';
import { SessionHost } from './session/session.host';

@Injectable()
export class AuthenticationDrizzleRepository implements PublicOf<AuthenticationRepository> {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly session: SessionHost,
  ) {}

  async saveSessionToken(token: string) {
    await this.drizzle.client.insert(authSessions).values({ token });
  }

  async resumeSession(token: string, impersonatee?: ID) {
    const row = await this.drizzle.client.query.authSessions.findFirst({
      where: (session) =>
        and(eq(session.token, token), eq(session.active, true)),
      with: { user: { with: { globalRoles: true } } },
    });
    if (!row) return null;

    // User-liveness: Neo4j enforces this structurally (deleting a user
    // relabels the node, so the session→user match fails and the session
    // degrades to anonymous). Mirror that: a soft-deleted user's session
    // resolves as anonymous instead of retaining its identity. The
    // delete→revoke-sessions hook deactivates these outright; this guards
    // any session the hook missed (e.g. created before the hook shipped).
    const user = row.user && !row.user.deletedAt ? row.user : null;
    const roles = (user?.globalRoles ?? []).map(
      (globalRole) => globalRole.role,
    );
    const userId = user ? row.userId : null;

    if (!impersonatee) {
      return { userId, roles };
    }

    const impersonateeRoles = await this.rolesForUser(impersonatee);
    return { userId, roles, impersonateeRoles };
  }

  async disconnectUserFromSession(token: string) {
    // Logout makes the session anonymous again; the token stays alive.
    await this.drizzle.client
      .update(authSessions)
      .set({ userId: null, loggedInAt: null })
      .where(eq(authSessions.token, token));
  }

  async connectSessionToUser(input: LoginInput, session: Session) {
    const user = await this.drizzle.client.query.users.findFirst({
      where: (user) => and(eq(user.email, input.email), isNull(user.deletedAt)),
    });
    if (!user) return undefined;

    const result = await this.drizzle.client
      .update(authSessions)
      .set({ userId: user.id, loggedInAt: new Date() })
      .where(
        and(
          eq(authSessions.token, session.token),
          eq(authSessions.active, true),
        ),
      )
      .returning();

    return result.length > 0 ? user.id : undefined;
  }

  async deactivateAllOtherSessions(session: Session) {
    if (session.anonymous) return;
    await this.drizzle.client
      .update(authSessions)
      .set({ active: false })
      .where(
        and(
          eq(authSessions.userId, session.userId),
          ne(authSessions.token, session.token),
          eq(authSessions.active, true),
        ),
      );
  }

  async deactivateAllOtherSessionsByEmail(email: string, session: Session) {
    const user = await this.drizzle.client.query.users.findFirst({
      where: (user) => eq(user.email, email),
    });
    if (!user) return;

    await this.drizzle.client
      .update(authSessions)
      .set({ active: false })
      .where(
        and(
          eq(authSessions.userId, user.id),
          ne(authSessions.token, session.token),
          eq(authSessions.active, true),
        ),
      );
  }

  async deactivateAllSessions(user: ID<'User'>) {
    await this.drizzle.client
      .update(authSessions)
      .set({ active: false })
      .where(eq(authSessions.userId, user));
  }

  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    await this.drizzle.client
      .insert(authIdentities)
      .values({ userId, passwordHash })
      .onConflictDoUpdate({
        target: authIdentities.userId,
        set: { passwordHash, updatedAt: new Date() },
      });
  }

  async getCurrentPasswordHash() {
    const { userId } = this.session.current;
    const row = await this.drizzle.client.query.authIdentities.findFirst({
      where: (identity) => eq(identity.userId, userId),
    });
    return row?.passwordHash ?? null;
  }

  async updatePassword(newPasswordHash: string) {
    const { userId } = this.session.current;
    await this.drizzle.client
      .update(authIdentities)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(authIdentities.userId, userId));
  }

  async getInfoForLogin({ email }: LoginInput) {
    const rows = await this.drizzle.client
      .select({
        passwordHash: authIdentities.passwordHash,
        status: users.status,
      })
      .from(users)
      .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    return rows[0]
      ? {
          passwordHash: rows[0].passwordHash,
          status: rows[0].status,
        }
      : null;
  }

  async doesEmailAddressExist(email: string) {
    // Liveness matters here: Neo4j relabels the EmailAddress property node to
    // Deleted_EmailAddress on user delete, so its existence check is false for
    // deleted users and forgotPassword silently skips them — same void
    // response either way, no deletion oracle. savePasswordResetToken below
    // stays liveness-blind because this gate makes it unreachable for
    // deleted emails.
    const row = await this.drizzle.client.query.users.findFirst({
      where: (user) => and(eq(user.email, email), isNull(user.deletedAt)),
    });
    return !!row;
  }

  async savePasswordResetToken(email: string, token: string) {
    const user = await this.drizzle.client.query.users.findFirst({
      where: (user) => eq(user.email, email),
    });
    if (!user) {
      throw new ServerException('Could not find user by email');
    }
    await this.drizzle.client
      .insert(authPasswordResetTokens)
      .values({ email, token, userId: user.id });
  }

  async findPasswordResetToken(token: string) {
    const row =
      await this.drizzle.client.query.authPasswordResetTokens.findFirst({
        where: (resetToken) => eq(resetToken.token, token),
        with: { user: { columns: { id: true, deletedAt: true } } },
      });
    // A token whose user has since been soft-deleted is dead — completing
    // the reset would overwrite the deleted account's identity hash
    // (account takeover on any future restore). Same invalid-token path as
    // an unknown token. (savePasswordResetToken stays liveness-blind on
    // purpose: forgotPassword must not error differently for deleted
    // emails, and the token can never be consumed.)
    if (!row?.user || row.user.deletedAt) return null;
    return {
      email: row.email,
      token: row.token,
      userId: row.userId,
      createdOn: DateTime.fromJSDate(row.createdOn),
    };
  }

  async updatePasswordViaEmailToken(
    { email }: { email: string },
    passwordHash: string,
  ) {
    // Liveness backstop for findPasswordResetToken's check above.
    const user = await this.drizzle.client.query.users.findFirst({
      where: (user) => and(eq(user.email, email), isNull(user.deletedAt)),
    });
    if (!user) {
      throw new ServerException(
        'Failed to reset password',
        new ServerException('Could not find user by email'),
      );
    }
    await this.savePasswordHashOnUser(user.id, passwordHash);
    return { user: { id: user.id } };
  }

  async removeAllPasswordResetTokensByEmail(email: string) {
    // migration-todo: switch to userId after Gel and Neo4j are removed
    await this.drizzle.client
      .delete(authPasswordResetTokens)
      .where(eq(authPasswordResetTokens.email, email));
  }

  async rolesForUser(user: ID) {
    // Liveness join — Neo4j starts from a `:User` match, so a deleted user
    // yields [] there; mirror that so stale roles can't feed sessionForUser
    // / impersonation merges.
    const rows = await this.drizzle.client
      .select({ role: userGlobalRoles.role })
      .from(userGlobalRoles)
      .innerJoin(
        users,
        and(eq(users.id, userGlobalRoles.userId), isNull(users.deletedAt)),
      )
      .where(eq(userGlobalRoles.userId, user));
    return rows.map((row) => row.role);
  }

  async getRootUserId() {
    const row = await this.drizzle.client.query.users.findFirst({
      where: (user) => eq(user.isRoot, true),
    });
    if (!row) throw new ServerException('Could not find root user');
    return row.id;
  }

  async waitForRootUserId(): Promise<ID> {
    const find = () =>
      this.drizzle.client.query.users.findFirst({
        where: (user) => eq(user.isRoot, true),
      });
    let row;
    try {
      row = await find();
    } catch {
      // Database not ready yet, will retry below
    }
    while (!row) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1000).unref();
      });
      try {
        row = await find();
      } catch {
        // Continue retrying on error
      }
    }
    return row.id;
  }
}
