import { Injectable } from '@nestjs/common';
import { EmailService } from '@seedcompany/nestjs-email';
import { sign, verify } from 'jsonwebtoken';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  InputException,
  ServerException,
  Session,
  UnauthenticatedException,
} from '../../common';
import { RawSession } from '../../common/session';
import { ConfigService, ILogger, Logger } from '../../core';
import { ForgotPassword } from '../../core/email/templates';
import { AuthorizationService } from '../authorization/authorization.service';
import { User, UserService } from '../user';
import { LoginInput, ResetPasswordInput } from './authentication.dto';
import { AuthenticationRepository } from './authentication.repository';
import { CryptoService } from './crypto.service';
import { RegisterInput } from './dto';
import { NoSessionException } from './no-session.exception';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthenticationService {
  constructor(
    // private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly email: EmailService,
    private readonly userService: UserService,
    private readonly authorizationService: AuthorizationService,
    @Logger('authentication:service') private readonly logger: ILogger,
    private readonly authenticationRepo: AuthenticationRepository
  ) {}

  async createToken(): Promise<string> {
    const token = this.encodeJWT();

    const result = await this.authenticationRepo.createToken(token);
    if (!result) {
      throw new ServerException('Failed to start session');
    }
    return result.token;
  }

  async userFromSession(session: Session): Promise<User | null> {
    const userRes = await this.authenticationRepo.userFromSession(session);
    if (!userRes) {
      return null;
    }

    return await this.userService.readOne(userRes.id, session);
  }

  async register(input: RegisterInput, session?: Session): Promise<ID> {
    // ensure no other tokens are associated with this user
    if (session) {
      await this.logout(session.token);
    }

    let userId;
    try {
      userId = await this.userService.create(input, session);
    } catch (e) {
      // remap field prop as `email` field is at a different location in register() than createPerson()
      if (e instanceof DuplicateException && e.field === 'person.email') {
        throw e.withField('email');
      }
      throw e;
    }

    const passwordHash = await this.crypto.hash(input.password);
    await this.authenticationRepo.register(userId, passwordHash);

    return userId;
  }

  async login(input: LoginInput, session: Session): Promise<ID> {
    const result1 = await this.authenticationRepo.login1(input, session);

    if (!(await this.crypto.verify(result1?.pash, input.password))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const result2 = await this.authenticationRepo.login2(input, session);

    if (!result2 || !result2.id) {
      throw new ServerException('Login failed');
    }

    return result2.id;
  }

  async logout(token: string): Promise<void> {
    await this.authenticationRepo.logout(token);
  }

  async createSession(token: string): Promise<RawSession> {
    this.logger.debug('Decoding token', { token });

    const { iat } = this.decodeJWT(token);

    // check token in db to verify the user id and owning org id.

    const result = await this.authenticationRepo.createSession(token);

    if (!result) {
      this.logger.debug('Failed to find active token in database', { token });
      throw new NoSessionException(
        'Session has not been established',
        'NoSession'
      );
    }

    const roles = await this.authorizationService.getUserGlobalRoles(
      result.userId
    );

    const session = {
      token,
      issuedAt: DateTime.fromMillis(iat),
      userId: result.userId,
      roles: roles,
    };
    this.logger.debug('Created session', session);
    return session;
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
    session: Session
  ): Promise<void> {
    if (!oldPassword)
      throw new InputException('Old Password Required', 'oldPassword');

    const result = await this.authenticationRepo.changePassword(session);

    if (!(await this.crypto.verify(result?.passwordHash, oldPassword))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const newPasswordHash = await this.crypto.hash(newPassword);

    // inactivate all the relationships between the current user and all of their tokens except current one

    await this.authenticationRepo.createNewPassword(newPasswordHash, session);
  }

  async forgotPassword(email: string): Promise<void> {
    await this.authenticationRepo.forgotPasswordFindEmail(email);
    const result = await this.authenticationRepo.forgotPasswordFindEmail(email);

    if (!result) {
      this.logger.warning('Email not found; Skipping reset email', { email });
      return;
    }

    const token = this.encodeJWT();

    await this.authenticationRepo.forgotPasswordCreateToken(email, token);
    await this.email.send(email, ForgotPassword, {
      token,
    });
  }

  async resetPassword(
    { token, password }: ResetPasswordInput,
    session: Session
  ): Promise<void> {
    const result = await this.authenticationRepo.resetPassword(token);

    if (!result) {
      throw new InputException('Token is invalid', 'TokenInvalid');
    }
    const createdOn: DateTime = result.createdOn;

    if (createdOn.diffNow().as('days') > 1) {
      throw new InputException('Token has expired', 'TokenExpired');
    }

    const pash = await this.crypto.hash(password);

    await this.authenticationRepo.resetPasswordRemoveOldData(
      token,
      result,
      pash,
      session
    );

    // remove all the email tokens and invalidate old tokens
  }

  private encodeJWT() {
    const payload: JwtPayload = {
      iat: Date.now(),
    };

    return sign(payload, this.config.jwtKey);
  }

  private decodeJWT(token?: string) {
    if (!token) {
      throw new UnauthenticatedException();
    }

    try {
      return verify(token, this.config.jwtKey) as JwtPayload;
    } catch (exception) {
      this.logger.warning('Failed to validate JWT', {
        exception,
      });
      throw new UnauthenticatedException(exception);
    }
  }
}
