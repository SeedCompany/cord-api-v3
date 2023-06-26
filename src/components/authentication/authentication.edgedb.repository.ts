import { Injectable } from '@nestjs/common';
import { IntegrityError } from 'edgedb';
import { ID, PublicOf, ServerException, Session } from '~/common';
import { e, EdgeDb, withScope } from '~/core/edgedb';
import type { AuthenticationRepository } from './authentication.repository';
import { LoginInput } from './dto';

@Injectable()
export class AuthenticationEdgedbRepository
  implements PublicOf<AuthenticationRepository>
{
  constructor(protected readonly db: EdgeDb) {}

  async saveSessionToken(token: string) {
    const query = e.insert(e.Auth.Session, { token });
    await query.run(this.db);
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
    await query.run(this.db);
  }

  async getPasswordHash(
    { email }: LoginInput,
    _session: Session, // former impl asserted session was found, but not used.
  ): Promise<string | undefined> {
    const query = e.select(e.Auth.Identity, (identity) => ({
      passwordHash: true,
      filter_single: e.op(identity.user.email, '=', email),
    }));
    const result = await query.run(this.db);
    return result?.passwordHash;
  }

  async connectSessionToUser(input: LoginInput, session: Session): Promise<ID> {
    try {
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
      const query = e.with([user, updateSession], e.select(user));
      const result = await query.run(this.db);
      return result.id;
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
    await query.run(this.db);
  }

  async resumeSession(token: string, impersonateeId?: ID) {
    const query = e.assert_exists(
      e.select(e.Auth.Session, () => ({
        filter_single: { token },
        user: (user) => ({
          id: true,
          firstRole: withScope('global', e.array_agg(user.roles)),
          scopedRoles: withScope('global', user.roles),
        }),
        impersonatee: e.assert_single(
          e.select(e.detached(e.User), (user) => ({
            scopedRoles: withScope('global', user.roles),
            filter: e.op(
              user.id,
              '=',
              impersonateeId ?? e.cast(e.uuid, e.set()),
            ),
          })),
        ),
      })),
    );
    const { user, impersonatee } = await query.run(this.db);
    return {
      userId: user?.id,
      roles: user?.scopedRoles ?? [],
      impersonateeRoles: impersonatee?.scopedRoles,
    };
  }

  async rolesForUser(userId: ID) {
    const query = e.select(e.User, (user) => ({
      scopedRoles: withScope('global', user.roles),
      filter_single: { id: userId },
    }));
    const result = await query.run(this.db);
    return result?.scopedRoles ?? [];
  }

  async getCurrentPasswordHash(session: Session): Promise<string | undefined> {
    const query = e.select(e.Auth.Identity, (identity) => ({
      passwordHash: true,
      filter_single: e.op(identity.user.id, '=', session.userId),
    }));
    const result = await query.run(this.db);
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
    await query.run(this.db);
  }

  async userByEmail(email: string) {
    const query = e.select(e.User, () => ({
      filter_single: { email },
    }));
    const result = await query.run(this.db);
    return result?.id;
  }

  async doesEmailAddressExist(email: string): Promise<boolean> {
    return !!(await this.userByEmail(email));
  }

  async saveEmailToken(email: string, token: string): Promise<void> {
    const query = e.insert(e.Auth.EmailToken, { email, token });
    await query.run(this.db);
  }

  async findEmailToken(token: string) {
    const query = e.select(e.Auth.EmailToken, (et) => ({
      ...et['*'],
      createdOn: et.createdAt, // backwards compatibility
      filter_single: { token },
    }));
    const result = await query.run(this.db);
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
    await query.run(this.db);
  }

  async deactivateAllOtherSessions(session: Session) {
    const query = e.delete(e.Auth.Session, (s) => ({
      filter: e.op(
        e.op(s.user.id, '=', session.userId),
        'and',
        e.op(s.token, '!=', session.token),
      ),
    }));
    await query.run(this.db);
  }

  async deactivateAllOtherSessionsByEmail(email: string, session: Session) {
    const query = e.delete(e.Auth.Session, (s) => ({
      filter: e.op(
        e.op(s.user.email, '=', email),
        'and',
        e.op(s.token, '!=', session.token),
      ),
    }));
    await query.run(this.db);
  }
}
