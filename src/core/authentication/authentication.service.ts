import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { EmailService } from '@seedcompany/nestjs-email';
import {
  DuplicateException,
  type ID,
  InputException,
  ServerException,
  UnauthenticatedException,
} from '~/common';
import { ILogger, Logger } from '~/core/logger';
import { ForgotPassword } from '../email/templates';
import { disableAccessPolicies, Gel } from '../gel';
import { AuthenticationRepository } from './authentication.repository';
import { CryptoService } from './crypto.service';
import type { LoginInput, RegisterInput, ResetPasswordInput } from './dto';
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
    private readonly email: EmailService,
    @Logger('authentication:service') private readonly logger: ILogger,
    private readonly repo: AuthenticationRepository,
    private readonly gel: Gel,
    private readonly jwt: JwtService,
    private readonly sessionManager: SessionManager,
    private readonly sessionHost: SessionHost,
    private readonly moduleRef: ModuleRef,
  ) {}

  async register({ password, ...input }: RegisterInput): Promise<ID> {
    const session = this.sessionHost.currentIfInCtx;

    // ensure no other tokens are associated with this user
    if (session) {
      await this.logout(session.token, false);
    }

    let userId;
    try {
      const userMod = await import('../../components/user');
      const users = this.moduleRef.get(userMod.UserService, { strict: false });
      userId = await this.gel.usingOptions(
        disableAccessPolicies,
        async () => await users.create(input),
      );
    } catch (e) {
      // remap field prop as `email` field is at a different location in register() than createPerson()
      if (e instanceof DuplicateException && e.field === 'person.email') {
        throw e.withField('email');
      }
      throw e;
    }

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
    const hash = await this.repo.getPasswordHash(input);

    if (!(await this.crypto.verify(hash, input.password))) {
      throw new UnauthenticatedException('Invalid credentials');
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

  async logout(token: string, refresh = true): Promise<void> {
    await this.repo.disconnectUserFromSession(token);
    refresh && (await this.sessionManager.refreshCurrentSession());
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
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

  async forgotPassword(email: string): Promise<void> {
    const exists = await this.repo.doesEmailAddressExist(email);
    if (!exists) {
      this.logger.warning('Email not found; Skipping reset email', { email });
      return;
    }

    const token = this.jwt.encode();

    await this.repo.saveEmailToken(email, token);
    await this.email.send(email, ForgotPassword, {
      token,
    });
  }

  async resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    const emailToken = await this.repo.findEmailToken(token);
    if (!emailToken) {
      throw new InputException('Token is invalid', 'TokenInvalid');
    }

    if (emailToken.createdOn.diffNow().as('days') > 1) {
      throw new InputException('Token has expired', 'TokenExpired');
    }

    const pash = await this.crypto.hash(password);

    await this.repo.updatePasswordViaEmailToken(emailToken, pash);
    await this.repo.deactivateAllOtherSessionsByEmail(
      emailToken.email,
      this.sessionHost.current,
    );
    await this.repo.removeAllEmailTokensForEmail(emailToken.email);
  }
}
