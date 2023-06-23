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
    const query = e.params(
      { userId: e.uuid, passwordHash: e.str },
      ({ userId, passwordHash }) => {
        const user = e.select(e.User, () => ({
          filter_single: { id: userId },
        }));
        const insert = e.insert(e.Auth.Identity, { user, passwordHash });
        const update = e.update(e.Auth.Identity, () => ({
          filter_single: { user },
          set: { passwordHash },
        }));
        return insert.unlessConflict((identity) => ({
          on: identity.user,
          else: update,
        }));
      },
    );
    await query.run(this.db, { userId, passwordHash });
  }

  async getPasswordHash(
    { email }: LoginInput,
    _session: Session, // former impl asserted session was found, but not used.
  ): Promise<string | undefined> {
    const query = e.params({ email: e.str }, ({ email }) =>
      e.select(e.Auth.Identity, (identity) => ({
        filter_single: e.op(identity.user.email, '=', email),
        passwordHash: true,
      })),
    );
    const result = await query.run(this.db, { email });
    return result?.passwordHash;
  }

  async connectSessionToUser(input: LoginInput, session: Session): Promise<ID> {
    try {
      const query = e.params(
        { email: e.str, token: e.str },
        ({ email, token }) => {
          const user = e.assert_exists(
            { message: 'User not found' },
            e.select(e.User, () => ({
              filter_single: { email },
            })),
          );
          const session = e.assert_exists(
            { message: 'Token not found' },
            e.update(e.Auth.Session, () => ({
              filter_single: { token },
              set: { user },
            })),
          );
          return e.with([user, session], e.select(user));
        },
      );
      const result = await query.run(this.db, {
        email: input.email,
        token: session.token,
      });
      return result.id;
    } catch (e) {
      if (e instanceof IntegrityError) {
        throw new ServerException('Login failed', e);
      }
      throw e;
    }
  }

  async deleteSessionToken(token: string): Promise<void> {
    const query = e.params({ token: e.str }, ({ token }) =>
      e.delete(e.Auth.Session, () => ({
        filter_single: { token },
      })),
    );
    await query.run(this.db, { token });
  }

  async resumeSession(token: string, impersonateeId?: ID) {
    const query = e.params(
      { token: e.str, impersonateeId: e.optional(e.uuid) },
      ({ token, impersonateeId }) =>
        e.assert_exists(
          e.select(e.Auth.Session, () => ({
            filter_single: { token },
            user: (user) => ({
              id: true,
              firstRole: withScope('global', e.array_agg(user.roles)),
              scopedRoles: withScope('global', user.roles),
            }),
            impersonatee: e.select(e.User, (user) => ({
              filter_single: { id: impersonateeId },
              scopedRoles: withScope('global', user.roles),
            })),
          })),
        ),
    );
    const { user, impersonatee } = await query.run(this.db, {
      token,
      impersonateeId,
    });
    return {
      userId: user?.id,
      roles: user?.scopedRoles ?? [],
      impersonateeRoles: impersonatee?.scopedRoles,
    };
  }

  async rolesForUser(user: ID) {
    const query = e.params({ id: e.uuid }, ({ id }) =>
      e.select(e.User, (user) => ({
        filter_single: { id },
        scopedRoles: withScope('global', user.roles),
      })),
    );
    const result = await query.run(this.db, { id: user });
    return result?.scopedRoles ?? [];
  }

  async getCurrentPasswordHash(session: Session): Promise<string | undefined> {
    const query = e.params({ id: e.uuid }, ({ id }) =>
      e.select(e.Auth.Identity, (identity) => ({
        filter_single: e.op(identity.user.id, '=', id),
        passwordHash: true,
      })),
    );
    const result = await query.run(this.db, { id: session.userId });
    return result?.passwordHash;
  }

  async updatePassword(
    newPasswordHash: string,
    session: Session,
  ): Promise<void> {
    const query = e.params(
      { userId: e.uuid, passwordHash: e.str },
      ({ userId, passwordHash }) =>
        e.update(e.Auth.Identity, (identity) => ({
          filter_single: e.op(identity.user.id, '=', userId),
          set: { passwordHash },
        })),
    );
    await query.run(this.db, {
      userId: session.userId,
      passwordHash: newPasswordHash,
    });
  }

  async userByEmail(email: string) {
    const query = e.params({ email: e.str }, ({ email }) =>
      e.select(e.User, () => ({
        filter_single: { email },
      })),
    );
    const result = await query.run(this.db, { email });
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
    const query = e.params({ token: e.str }, ({ token }) =>
      e.select(e.Auth.EmailToken, (et) => ({
        filter_single: { token },
        ...et['*'],
        createdOn: et.createdAt,
      })),
    );
    const result = await query.run(this.db, { token });
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
    const query = e.params({ email: e.str }, ({ email }) =>
      e.delete(e.Auth.EmailToken, (et) => ({
        filter: e.op(et.email, '=', email),
      })),
    );
    await query.run(this.db, { email });
  }

  async deactivateAllOtherSessions(session: Session) {
    const query = e.params({ token: e.str, user: e.uuid }, ({ token, user }) =>
      e.delete(e.Auth.Session, (session) => ({
        filter: e.op(
          e.op(session.user.id, '=', user),
          'and',
          e.op(session.token, '!=', token),
        ),
      })),
    );
    await query.run(this.db, { token: session.token, user: session.userId });
  }

  async deactivateAllOtherSessionsByEmail(email: string, session: Session) {
    const query = e.params({ token: e.str, email: e.str }, ({ token, email }) =>
      e.delete(e.Auth.Session, (session) => ({
        filter: e.op(
          e.op(session.user.email, '=', email),
          'and',
          e.op(session.token, '!=', token),
        ),
      })),
    );
    await query.run(this.db, { token: session.token, email });
  }
}
