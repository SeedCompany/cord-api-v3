import { Injectable } from '@nestjs/common';
import { IntegrityError } from 'gel';
import { ID, PublicOf, ServerException, Session } from '~/common';
import { RootUserAlias } from '~/core/config/root-user.config';
import { disableAccessPolicies, e, Gel, withScope } from '~/core/gel';
import type { AuthenticationRepository } from './authentication.repository';
import { LoginInput } from './dto';

@Injectable()
export class AuthenticationGelRepository
  implements PublicOf<AuthenticationRepository>
{
  private readonly db: Gel;
  constructor(db: Gel) {
    this.db = db.withOptions(disableAccessPolicies);
  }

  async waitForRootUserId() {
    await this.db.waitForConnection({
      forever: true,
      maxTimeout: { seconds: 10 },
      unref: true,
    });
    return await this.getRootUserId();
  }

  async getRootUserId() {
    const rootAlias = e.select(e.Alias, () => ({
      filter_single: { name: RootUserAlias },
    }));
    const query = e.assert_exists(rootAlias).target.id;
    return await this.db.run(query);
  }

  async saveSessionToken(token: string) {
    await this.db.run(this.saveSessionTokenQuery, { token });
  }
  private readonly saveSessionTokenQuery = e.params(
    { token: e.str },
    ({ token }) => e.insert(e.Auth.Session, { token }),
  );

  async savePasswordHashOnUser(userId: ID, passwordHash: string) {
    await this.db.run(this.savePasswordHashOnUserQuery, {
      userId,
      passwordHash,
    });
  }
  private readonly savePasswordHashOnUserQuery = e.params(
    { userId: e.uuid, passwordHash: e.str },
    ({ userId, passwordHash }) => {
      const user = e.cast(e.User, userId);
      return e
        .insert(e.Auth.Identity, { user, passwordHash })
        .unlessConflict((identity) => ({
          on: identity.user,
          else: e.update(e.Auth.Identity, () => ({
            filter_single: { user },
            set: { passwordHash },
          })),
        }));
    },
  );

  async getPasswordHash({ email }: LoginInput) {
    return await this.db.run(this.getPasswordHashQuery, { email });
  }
  private readonly getPasswordHashQuery = e.params(
    { email: e.str },
    ({ email }) => {
      const identity = e.select(e.Auth.Identity, (identity) => ({
        filter_single: e.op(identity.user.email, '=', email),
      }));
      return identity.passwordHash;
    },
  );

  async connectSessionToUser(input: LoginInput, session: Session): Promise<ID> {
    try {
      return await this.db.run(this.connectUserFromSessionQuery, {
        email: input.email,
        token: session.token,
      });
    } catch (e) {
      if (e instanceof IntegrityError) {
        throw new ServerException('Login failed', e);
      }
      throw e;
    }
  }
  private readonly connectUserFromSessionQuery = e.params(
    { email: e.str, token: e.str },
    ({ email, token }) => {
      const user = e.assert_exists(
        { message: 'User not found' },
        e.select(e.User, () => ({
          filter_single: { email },
        })),
      );
      const updatedSession = e.assert_exists(
        { message: 'Token not found' },
        e.update(e.Auth.Session, () => ({
          filter_single: { token },
          set: { user },
        })),
      );
      return e.assert_exists(updatedSession.user).id;
    },
  );

  async disconnectUserFromSession(token: string): Promise<void> {
    await this.db.run(this.disconnectUserFromSessionQuery, { token });
  }
  private readonly disconnectUserFromSessionQuery = e.params(
    { token: e.str },
    ({ token }) =>
      e.update(e.Auth.Session, () => ({
        filter_single: { token },
        set: { user: null },
      })),
  );

  async resumeSession(token: string, impersonateeId?: ID) {
    return await this.db.run(this.resumeSessionQuery, {
      token,
      impersonateeId,
    });
  }
  private readonly resumeSessionQuery = e.params(
    { token: e.str, impersonateeId: e.optional(e.uuid) },
    ({ token, impersonateeId }) => {
      // Not using object cast to avoid leaking not existent users to anonymous requests
      const impersonatee = e.select(e.User, () => ({
        filter_single: { id: impersonateeId },
      }));
      return e.select(e.Auth.Session, (session) => ({
        filter_single: { token },
        userId: session.user.id,
        roles: withScope('global', session.user.roles),
        impersonateeRoles: withScope('global', impersonatee.roles),
      }));
    },
  );

  async rolesForUser(userId: ID) {
    return await this.db.run(this.rolesForUserQuery, { userId });
  }
  private readonly rolesForUserQuery = e.params(
    { userId: e.uuid },
    ({ userId }) => {
      const user = e.cast(e.User, userId);
      return withScope('global', user.roles);
    },
  );

  async getCurrentPasswordHash(session: Session) {
    return await this.db.run(this.getCurrentPasswordHashQuery, {
      userId: session.userId,
    });
  }
  private readonly getCurrentPasswordHashQuery = e.params(
    { userId: e.uuid },
    ({ userId }) => {
      const user = e.cast(e.User, userId);
      const identity = e.select(e.Auth.Identity, () => ({
        filter_single: { user },
      }));
      return identity.passwordHash;
    },
  );

  async updatePassword(newPasswordHash: string, session: Session) {
    await this.db.run(this.updatePasswordQuery, {
      userId: session.userId,
      passwordHash: newPasswordHash,
    });
  }
  private readonly updatePasswordQuery = e.params(
    { userId: e.uuid, passwordHash: e.str },
    ({ userId, passwordHash }) => {
      const user = e.cast(e.User, userId);
      const identity = e.assert_exists(
        e.select(e.Auth.Identity, () => ({
          filter_single: { user },
        })),
      );
      return e.update(identity, () => ({
        set: { passwordHash },
      }));
    },
  );

  async userByEmail(email: string) {
    return await this.db.run(this.userByEmailQuery, { email });
  }
  private readonly userByEmailQuery = e.params(
    { email: e.str },
    ({ email }) => {
      const user = e.select(e.User, () => ({
        filter_single: { email },
      }));
      return user.id;
    },
  );

  async doesEmailAddressExist(email: string) {
    return !!(await this.userByEmail(email));
  }

  async saveEmailToken(email: string, token: string) {
    await this.db.run(this.saveEmailTokenQuery, { email, token });
  }
  private readonly saveEmailTokenQuery = e.params(
    { email: e.str, token: e.str },
    ({ email, token }) => e.insert(e.Auth.EmailToken, { email, token }),
  );

  async findEmailToken(token: string) {
    return await this.db.run(this.findEmailTokenQuery, { token });
  }
  private readonly findEmailTokenQuery = e.params(
    { token: e.str },
    ({ token }) =>
      e.select(e.Auth.EmailToken, (et) => ({
        ...et['*'],
        createdOn: et.createdAt, // backwards compatibility
        filter_single: { token },
      })),
  );

  async updatePasswordViaEmailToken(
    { email }: { email: string },
    passwordHash: string,
  ) {
    const userId = await this.userByEmail(email);
    await this.savePasswordHashOnUser(userId!, passwordHash);
  }

  async removeAllEmailTokensForEmail(email: string) {
    await this.db.run(this.removeAllEmailTokensForEmailQuery, { email });
  }
  private readonly removeAllEmailTokensForEmailQuery = e.params(
    { email: e.str },
    ({ email }) =>
      e.delete(e.Auth.EmailToken, (et) => ({
        filter: e.op(et.email, '=', email),
      })),
  );

  async deactivateAllOtherSessions(session: Session) {
    await this.db.run(this.deactivateAllOtherSessionsQuery, {
      userId: session.userId,
      token: session.token,
    });
  }
  private readonly deactivateAllOtherSessionsQuery = e.params(
    { userId: e.uuid, token: e.str },
    ({ userId, token }) =>
      e.update(e.Auth.Session, (s) => ({
        filter: e.op(
          e.op(s.user.id, '=', userId),
          'and',
          e.op(s.token, '!=', token),
        ),
        set: { user: null },
      })),
  );

  async deactivateAllOtherSessionsByEmail(email: string, session: Session) {
    await this.db.run(this.deactivateAllOtherSessionsByEmailQuery, {
      email,
      token: session.token,
    });
  }
  private readonly deactivateAllOtherSessionsByEmailQuery = e.params(
    { email: e.str, token: e.str },
    ({ email, token }) =>
      e.update(e.Auth.Session, (s) => ({
        filter: e.op(
          e.op(s.user.email, '=', email),
          'and',
          e.op(s.token, '!=', token),
        ),
        set: { user: null },
      })),
  );
}
