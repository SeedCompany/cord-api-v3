import { Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID, type PublicOf, type Role, ServerException } from '~/common';
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
    private readonly db: DrizzleService,
    private readonly session: SessionHost,
  ) {}

  async saveSessionToken(token: string) {
    await this.db.db.insert(authSessions).values({ token });
  }

  async resumeSession(token: string, impersonatee?: ID) {
    const row = await this.db.db.query.authSessions.findFirst({
      where: (s, { and: a, eq: e }) => a(e(s.token, token), e(s.active, true)),
      with: { user: { with: { globalRoles: true } } },
    });
    if (!row) return null;

    const roles = (row.user?.globalRoles ?? []).map((r) => r.role as Role);

    if (!impersonatee) {
      return { userId: row.userId as ID | null, roles };
    }

    const impersonateeRoles = await this.rolesForUser(impersonatee);
    return { userId: row.userId as ID | null, roles, impersonateeRoles };
  }

  async disconnectUserFromSession(token: string) {
    await this.db.db
      .update(authSessions)
      .set({ active: false })
      .where(eq(authSessions.token, token));
  }

  async connectSessionToUser(input: LoginInput, session: Session) {
    const user = await this.db.db.query.users.findFirst({
      where: (u, { eq: e }) => e(u.email, input.email),
    });
    if (!user) return undefined;

    const result = await this.db.db
      .update(authSessions)
      .set({ userId: user.id, loggedInAt: new Date() })
      .where(
        and(
          eq(authSessions.token, session.token),
          eq(authSessions.active, true),
        ),
      )
      .returning();

    return result.length > 0 ? (user.id as ID) : undefined;
  }

  async deactivateAllOtherSessions(session: Session) {
    if (session.anonymous) return;
    await this.db.db
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
    const user = await this.db.db.query.users.findFirst({
      where: (u, { eq: e }) => e(u.email, email),
    });
    if (!user) return;

    await this.db.db
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
    await this.db.db
      .update(authSessions)
      .set({ active: false })
      .where(eq(authSessions.userId, user));
  }

  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    await this.db.db
      .insert(authIdentities)
      .values({ userId, passwordHash })
      .onConflictDoUpdate({
        target: authIdentities.userId,
        set: { passwordHash, updatedAt: new Date() },
      });
  }

  async getCurrentPasswordHash() {
    const { userId } = this.session.current;
    const row = await this.db.db.query.authIdentities.findFirst({
      where: (ai, { eq: e }) => e(ai.userId, userId),
    });
    return row?.passwordHash ?? null;
  }

  async updatePassword(newPasswordHash: string) {
    const { userId } = this.session.current;
    await this.db.db
      .update(authIdentities)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(authIdentities.userId, userId));
  }

  async getInfoForLogin({ email }: LoginInput) {
    const rows = await this.db.db
      .select({
        passwordHash: authIdentities.passwordHash,
        status: users.status,
      })
      .from(users)
      .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);

    return rows[0]
      ? {
          passwordHash: rows[0].passwordHash,
          status: rows[0].status,
        }
      : null;
  }

  async doesEmailAddressExist(email: string) {
    const row = await this.db.db.query.users.findFirst({
      where: (u, { eq: e }) => e(u.email, email),
    });
    return !!row;
  }

  async savePasswordResetToken(email: string, token: string) {
    const user = await this.db.db.query.users.findFirst({
      where: (u, { eq: e }) => e(u.email, email),
    });
    if (!user) {
      throw new ServerException('Could not find user by email');
    }
    await this.db.db
      .insert(authPasswordResetTokens)
      .values({ email, token, userId: user.id });
  }

  async findPasswordResetToken(token: string) {
    const row = await this.db.db.query.authPasswordResetTokens.findFirst({
      where: (et, { eq: e }) => e(et.token, token),
    });
    return row
      ? {
          email: row.email,
          token: row.token,
          userId: row.userId as ID,
          createdOn: DateTime.fromJSDate(row.createdOn),
        }
      : null;
  }

  async updatePasswordViaEmailToken(
    { email }: { email: string },
    passwordHash: string,
  ) {
    const user = await this.db.db.query.users.findFirst({
      where: (u, { eq: e }) => e(u.email, email),
    });
    if (!user) {
      throw new ServerException(
        'Failed to reset password',
        new ServerException('Could not find user by email'),
      );
    }
    await this.savePasswordHashOnUser(user.id as ID, passwordHash);
    return { user: { id: user.id as ID } };
  }

  async removeAllPasswordResetTokensByEmail(email: string) {
    // migration-todo: switch to userId after Gel and Neo4j are removed
    await this.db.db
      .delete(authPasswordResetTokens)
      .where(eq(authPasswordResetTokens.email, email));
  }

  async rolesForUser(user: ID) {
    const rows = await this.db.db
      .select({ role: userGlobalRoles.role })
      .from(userGlobalRoles)
      .where(eq(userGlobalRoles.userId, user));
    return rows.map((r) => r.role as Role);
  }

  async getRootUserId() {
    const row = await this.db.db.query.users.findFirst({
      where: (u, { eq: e }) => e(u.isRoot, true),
    });
    if (!row) throw new ServerException('Could not find root user');
    return row.id as ID;
  }

  async waitForRootUserId(): Promise<ID> {
    const find = () =>
      this.db.db.query.users.findFirst({
        where: (u, { eq: e }) => e(u.isRoot, true),
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
    return row.id as ID;
  }
}
