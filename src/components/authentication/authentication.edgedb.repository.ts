import { Injectable } from '@nestjs/common';
import { IntegrityError } from 'edgedb';
import { ID, PublicOf, ServerException, Session } from '~/common';
import { disableAccessPolicies, e, EdgeDB, withScope } from '~/core/edgedb';
import type { AuthenticationRepository } from './authentication.repository';
import { LoginInput } from './dto';

@Injectable()
export class AuthenticationEdgeDBRepository
  implements PublicOf<AuthenticationRepository>
{
  private readonly db: EdgeDB;
  constructor(db: EdgeDB) {
    this.db = db.withOptions(disableAccessPolicies);
  }

  async waitForRootUserId() {
    await this.db.waitForConnection({
      forever: true,
      maxTimeout: { seconds: 10 },
    });
    return await this.getRootUserId();
  }

  async getRootUserId() {
    const query = e.assert_exists(e.select(e.RootUser).assert_single());
    const result = await this.db.run(query);
    return result.id;
  }

  async saveSessionToken(token: string) {
    const query = e.insert(e.Auth.Session, { token });
    await this.db.run(query);
  }

  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    const user = e.select(e.User, () => ({
      filter_single: { id: userId },
    }));
    const query = e
      .insert(e.Auth.Identity, { user, passwordHash })
      .unlessConflict((identity) => ({
        on: identity.user,
        else: e.update(e.Auth.Identity, () => ({
          filter_single: { user },
          set: { passwordHash },
        })),
      }));
    await this.db.run(query);
  }

  async getPasswordHash(
    { email }: LoginInput,
    _session: Session, // former impl asserted session was found, but not used.
  ): Promise<string | undefined> {
    const query = e.select(e.Auth.Identity, (identity) => ({
      passwordHash: true,
      filter_single: e.op(identity.user.email, '=', email),
    }));
    const result = await this.db.run(query);
    return result?.passwordHash;
  }

  async connectSessionToUser(input: LoginInput, session: Session): Promise<ID> {
    const user = e.assert_exists(
      { message: 'User not found' },
      e.select(e.User, () => ({
        filter_single: { email: input.email },
      })),
    );
    const updateSession = e.assert_exists(
      { message: 'Token not found' },
      e.update(e.Auth.Session, () => ({
        filter_single: { token: session.token },
        set: { user },
      })),
    );
    const query = e.select(updateSession, () => ({
      user: true,
    }));
    try {
      const result = await this.db.run(query);
      return result.user!.id;
    } catch (e) {
      if (e instanceof IntegrityError) {
        throw new ServerException('Login failed', e);
      }
      throw e;
    }
  }

  async deleteSessionToken(token: string): Promise<void> {
    const query = e.delete(e.Auth.Session, () => ({
      filter_single: { token },
    }));
    await this.db.run(query);
  }

  async resumeSession(token: string, impersonateeId?: ID) {
    const query = e.select(e.Auth.Session, () => ({
      filter_single: { token },
      user: (user) => ({
        id: true,
        scopedRoles: withScope('global', user.roles),
      }),
      impersonatee: e.assert_single(
        e.select(e.User, (user) => ({
          scopedRoles: withScope('global', user.roles),
          filter: e.op(user.id, '=', impersonateeId ?? e.cast(e.uuid, e.set())),
        })),
      ),
    }));
    const result = await this.db.run(query);
    if (!result) {
      return undefined;
    }
    return {
      userId: result?.user?.id,
      roles: result?.user?.scopedRoles ?? [],
      impersonateeRoles: result?.impersonatee?.scopedRoles,
    };
  }

  async rolesForUser(userId: ID) {
    const query = e.select(e.User, (user) => ({
      scopedRoles: withScope('global', user.roles),
      filter_single: { id: userId },
    }));
    const result = await this.db.run(query);
    return result?.scopedRoles ?? [];
  }

  async getCurrentPasswordHash(session: Session): Promise<string | undefined> {
    const query = e.select(e.Auth.Identity, (identity) => ({
      passwordHash: true,
      filter_single: e.op(identity.user.id, '=', session.userId),
    }));
    const result = await this.db.run(query);
    return result?.passwordHash;
  }

  async updatePassword(
    newPasswordHash: string,
    session: Session,
  ): Promise<void> {
    const query = e.update(e.Auth.Identity, (identity) => ({
      filter_single: e.op(identity.user.id, '=', session.userId),
      set: { passwordHash: newPasswordHash },
    }));
    await this.db.run(query);
  }

  async userByEmail(email: string) {
    const query = e.select(e.User, () => ({
      filter_single: { email },
    }));
    const result = await this.db.run(query);
    return result?.id;
  }

  async doesEmailAddressExist(email: string): Promise<boolean> {
    return !!(await this.userByEmail(email));
  }

  async saveEmailToken(email: string, token: string): Promise<void> {
    const query = e.insert(e.Auth.EmailToken, { email, token });
    await this.db.run(query);
  }

  async findEmailToken(token: string) {
    const query = e.select(e.Auth.EmailToken, (et) => ({
      ...et['*'],
      createdOn: et.createdAt, // backwards compatibility
      filter_single: { token },
    }));
    const result = await this.db.run(query);
    return result ?? undefined;
  }

  async updatePasswordViaEmailToken(
    { email }: { email: string },
    passwordHash: string,
  ): Promise<void> {
    const userId = await this.userByEmail(email);
    await this.savePasswordHashOnUser(userId!, passwordHash);
  }

  async removeAllEmailTokensForEmail(email: string) {
    const query = e.delete(e.Auth.EmailToken, (et) => ({
      filter: e.op(et.email, '=', email),
    }));
    await this.db.run(query);
  }

  async deactivateAllOtherSessions(session: Session) {
    const query = e.delete(e.Auth.Session, (s) => ({
      filter: e.op(
        e.op(s.user.id, '=', session.userId),
        'and',
        e.op(s.token, '!=', session.token),
      ),
    }));
    await this.db.run(query);
  }

  async deactivateAllOtherSessionsByEmail(email: string, session: Session) {
    const query = e.delete(e.Auth.Session, (s) => ({
      filter: e.op(
        e.op(s.user.email, '=', email),
        'and',
        e.op(s.token, '!=', session.token),
      ),
    }));
    await this.db.run(query);
  }
}
