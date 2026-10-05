import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { type ID, ServerException } from '~/common';
import {
  authIdentitiesAuth0,
  authSessions,
  DrizzleService,
  userGlobalRoles,
  users,
} from '~/core/drizzle';
import { type Session } from './session/session.dto';

@Injectable()
export class AuthenticationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

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

  async connectSessionToUser(input: { email: string }, session: Session) {
    const user = await this.drizzle.client.query.users.findFirst({
      where: (user) => and(eq(user.email, input.email), isNull(user.deletedAt)),
    });
    if (!user) return undefined;

    return await this.connectSessionToUserId(user.id, session);
  }

  // Auth0's `sub` is the stable re-match key for an already-linked user —
  // unlike a fresh email match, we must not re-derive the user by email
  // here, since the claims' email can drift from what's on file (Okta
  // profile edit, Auth0-side password reset, etc.) without us knowing.
  async connectSessionToUserId(userId: ID<'User'>, session: Session) {
    const result = await this.drizzle.client
      .update(authSessions)
      .set({ userId, loggedInAt: new Date() })
      .where(
        and(
          eq(authSessions.token, session.token),
          eq(authSessions.active, true),
        ),
      )
      .returning();

    return result.length > 0 ? userId : undefined;
  }

  async deactivateAllSessions(user: ID<'User'>) {
    await this.drizzle.client
      .update(authSessions)
      .set({ active: false })
      .where(eq(authSessions.userId, user));
  }

  // Returns `status` alongside `id` (a small deviation from "id or
  // undefined") so the Auth0 login flow can refuse a disabled account
  // without a second round trip. Soft-deleted users resolve to `undefined`,
  // same liveness pattern as `connectSessionToUser` above — a stale
  // identity row left behind after a user is deleted must not silently
  // resurrect their session.
  async findUserByAuth0Sub(sub: string) {
    const row = await this.drizzle.client.query.authIdentitiesAuth0.findFirst({
      where: (identity) => eq(identity.sub, sub),
      with: {
        user: { columns: { id: true, status: true, deletedAt: true } },
      },
    });
    if (!row?.user || row.user.deletedAt) return undefined;
    return { id: row.user.id, status: row.user.status };
  }

  // Unlike `connectSessionToUser`/`doesEmailAddressExist`, this is NOT
  // liveness-filtered — the Auth0 login flow needs to tell "no user has
  // this email" (JIT-provision) apart from "a user has this email but is
  // disabled/deleted" (refuse), which it can't do if deleted rows are
  // already excluded from the query.
  async findUserStatusByEmail(email: string) {
    const row = await this.drizzle.client.query.users.findFirst({
      where: (user) => eq(user.email, email),
      columns: { id: true, status: true, deletedAt: true },
    });
    return row;
  }

  async saveAuth0IdentityOnUser(userId: ID, sub: string) {
    await this.drizzle.client
      .insert(authIdentitiesAuth0)
      .values({ userId, sub })
      .onConflictDoUpdate({
        target: authIdentitiesAuth0.userId,
        set: { sub, updatedAt: new Date() },
      });
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
