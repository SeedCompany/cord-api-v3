import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  AuthenticationException,
  type ID,
  InputException,
  ServerException,
  UnauthenticatedException,
} from '~/common';
import { MailerService } from '~/core/email';
import { ILogger, Logger } from '~/core/logger';
import { type Auth0Claims, Auth0Service } from './auth0.service';
import { AuthenticationRepository } from './authentication.repository';
import { CryptoService } from './crypto.service';
import {
  type ChangePassword,
  type LoginInput,
  type LoginWithAuth0Input,
  type RegisterUser,
  type RequestPasswordReset,
  type ResetPassword,
} from './dto';
import { ForgotPassword } from './emails/forgot-password.email';
import { JwtService } from './jwt.service';
import { SessionHost } from './session/session.host';
import { SessionManager } from './session/session.manager';

/**
 * Service to back the GQL resolvers.
 */
@Injectable()
export class AuthenticationService {
  constructor(
    private readonly crypto: CryptoService,
    private readonly mailer: MailerService,
    @Logger('authentication:service') private readonly logger: ILogger,
    private readonly repo: AuthenticationRepository,
    private readonly jwt: JwtService,
    private readonly sessionManager: SessionManager,
    private readonly sessionHost: SessionHost,
    private readonly moduleRef: ModuleRef,
    private readonly auth0: Auth0Service,
  ) {}

  async register({ password, ...input }: RegisterUser): Promise<ID> {
    const session = this.sessionHost.currentIfInCtx;

    // ensure no other tokens are associated with this user
    if (session) {
      await this.logout(session.token, false);
    }

    const userMod = await import('../../components/user');
    const users = this.moduleRef.get(userMod.UserService, { strict: false });
    const { id: userId } = await users.create(input);

    const passwordHash = await this.crypto.hash(password);
    await this.repo.savePasswordHashOnUser(userId, passwordHash);

    if (!session) {
      return userId;
    }

    return await this.login({
      email: input.email,
      password,
    });
  }

  async login(input: LoginInput): Promise<ID> {
    const info = await this.repo.getInfoForLogin(input);

    if (!(await this.crypto.verify(info?.passwordHash, input.password))) {
      throw new UnauthenticatedException('Invalid credentials');
    }
    if (info!.status === 'Disabled') {
      throw new UserDisabledException();
    }

    const userId = await this.repo.connectSessionToUser(
      input,
      this.sessionHost.current,
    );

    if (!userId) {
      throw new ServerException('Login failed');
    }

    await this.sessionManager.refreshCurrentSession();

    return userId;
  }

  /**
   * Login via an Auth0-issued ID token, reusing the same session-issuance
   * machinery as password `login()`.
   *
   * Match order: `sub` (Auth0's stable subject id) first, then email,
   * then JIT-provision a brand-new user if neither matches. A disabled or
   * soft-deleted match is refused the same way the password path refuses
   * it — a disabled account gets `UserDisabledException`, same as `login()`
   * above; a deleted account gets the same opaque "Invalid credentials" as
   * an unknown password-login email, both to avoid a deleted-account oracle
   * and because `users.email` is uniquely constrained even across deleted
   * rows, so silently provisioning a new user over that email would just
   * fail with a DB constraint error instead.
   */
  async loginWithAuth0({ idToken }: LoginWithAuth0Input): Promise<ID> {
    const claims = await this.auth0.verifyToken(idToken);

    const bySub = await this.repo.findUserByAuth0Sub(claims.sub);
    if (bySub) {
      if (bySub.status === 'Disabled') {
        throw new UserDisabledException();
      }

      const userId = await this.repo.connectSessionToUserId(
        bySub.id,
        this.sessionHost.current,
      );
      if (!userId) {
        throw new ServerException('Login failed');
      }

      await this.sessionManager.refreshCurrentSession();
      return userId;
    }

    const existing = await this.repo.findUserStatusByEmail(claims.email);
    if (existing?.deletedAt) {
      throw new UnauthenticatedException('Invalid credentials');
    }
    if (existing?.status === 'Disabled') {
      throw new UserDisabledException();
    }

    if (!existing) {
      await this.provisionUserFromAuth0(claims);
    }

    const userId = await this.repo.connectSessionToUser(
      { email: claims.email },
      this.sessionHost.current,
    );
    if (!userId) {
      throw new ServerException('Login failed');
    }

    await this.repo.saveAuth0IdentityOnUser(userId, claims.sub);
    await this.sessionManager.refreshCurrentSession();
    return userId;
  }

  private async provisionUserFromAuth0(claims: Auth0Claims): Promise<ID> {
    const userMod = await import('../../components/user');
    const users = this.moduleRef.get(userMod.UserService, { strict: false });
    const nameParts = claims.name?.split(' ') ?? [];
    const given =
      claims.givenName ??
      nameParts[0] ??
      claims.email.split('@')[0] ??
      claims.email;
    const family = claims.familyName ?? (nameParts.slice(1).join(' ') || given);
    const { id } = await users.create({
      email: claims.email,
      realFirstName: given,
      realLastName: family,
      displayFirstName: given,
      displayLastName: family,
    });
    return id;
  }

  async logout(token: string, refresh = true): Promise<void> {
    await this.repo.disconnectUserFromSession(token);
    refresh && (await this.sessionManager.refreshCurrentSession());
  }

  async logoutByUser(user: ID<'User'>) {
    await this.repo.deactivateAllSessions(user);
  }

  async changePassword({
    oldPassword,
    newPassword,
  }: ChangePassword): Promise<void> {
    if (!oldPassword)
      throw new InputException('Old Password Required', 'oldPassword');

    const hash = await this.repo.getCurrentPasswordHash();

    if (!(await this.crypto.verify(hash, oldPassword))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const newPasswordHash = await this.crypto.hash(newPassword);
    await this.repo.updatePassword(newPasswordHash);

    await this.repo.deactivateAllOtherSessions(this.sessionHost.current);
  }

  async forgotPassword({ email }: RequestPasswordReset): Promise<void> {
    const exists = await this.repo.doesEmailAddressExist(email);
    if (!exists) {
      this.logger.warning('Email not found; Skipping reset email', { email });
      return;
    }

    const token = this.jwt.encode();

    await this.repo.savePasswordResetToken(email, token);
    await this.mailer.compose(email, [ForgotPassword, { token }]).send();
  }

  async resetPassword({ token, password }: ResetPassword) {
    const resetToken = await this.repo.findPasswordResetToken(token);
    if (!resetToken) {
      throw new InputException('Token is invalid', 'TokenInvalid');
    }

    if (resetToken.createdOn.diffNow().as('days') > 1) {
      throw new InputException('Token has expired', 'TokenExpired');
    }

    const pash = await this.crypto.hash(password);

    const { user } = await this.repo.updatePasswordViaEmailToken(
      resetToken,
      pash,
    );
    await this.repo.deactivateAllOtherSessionsByEmail(
      resetToken.email,
      this.sessionHost.current,
    );
    await this.repo.removeAllPasswordResetTokensByEmail(resetToken.email);
    return { user };
  }
}

export class UserDisabledException extends AuthenticationException {
  constructor() {
    super('User is disabled');
  }
}
