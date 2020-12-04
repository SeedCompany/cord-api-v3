import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { sign, verify } from 'jsonwebtoken';
import { pickBy } from 'lodash';
import { DateTime } from 'luxon';
import { Except } from 'type-fest';
import {
  DuplicateException,
  InputException,
  ServerException,
  Session,
  UnauthenticatedException,
} from '../../common';
import { RawSession } from '../../common/session';
import {
  ConfigService,
  DatabaseService,
  EmailService,
  ILogger,
  Logger,
} from '../../core';
import { DbV4 } from '../../core/database/v4/dbv4.service';
import { ErrorCode } from '../../core/database/v4/dto/ErrorCode.enum';
import { IdOut } from '../../core/database/v4/dto/GenericOut';
import { ForgotPassword } from '../../core/email/templates';
import { User, UserService } from '../user';
import { ApiUserOut } from '../user/dbv4';
import { DbUser } from '../user/model';
import { LoginInput, ResetPasswordInput } from './authentication.dto';
import { PashOut } from './dbv4/PashOut.dto';
import { RegisterInput } from './dto';
import { NoSessionException } from './no-session.exception';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly dbv4: DbV4,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly userService: UserService,
    @Logger('authentication:service') private readonly logger: ILogger
  ) {}

  async createToken(): Promise<string> {
    const token = this.encodeJWT();

    const result = await this.dbv4.post<{ id: string }>(
      'authentication/token/create',
      {
        id: token,
      }
    );
    return result.id;
  }

  async userFromSession(session: Session): Promise<User | null> {
    const result = await this.dbv4.post<ApiUserOut>(
      'api/user/userFromTokenUnsafe',
      {
        value: session.token,
      }
    );
    return result.user;
  }

  async register(input: RegisterInput, session?: Session): Promise<string> {
    const passwordHash = await argon2.hash(input.password, this.argon2Options);

    const result = await this.dbv4.post<IdOut>('authentication/register', {
      ...(input as Partial<DbUser>),
      password: passwordHash,
    });

    if (result.error === ErrorCode.UNIQUENESS_VIOLATION) {
      throw new DuplicateException(
        'person.email',
        'Email address is already in use'
      );
    }

    return result.id;
  }

  async login(input: LoginInput, session: Session): Promise<string> {
    const result = await this.dbv4.post<PashOut>(
      'authentication/login/getCreds',
      {
        token: session.token,
        email: input.email,
      }
    );

    if (
      result.error === ErrorCode.ID_NOT_FOUND ||
      !(await argon2.verify(result.pash, input.password, this.argon2Options))
    ) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const result2 = await this.dbv4.post<IdOut>(
      'authentication/login/getCreds',
      {
        token: session.token,
        email: input.email,
      }
    );

    if (!result2 || !result2.id) {
      throw new ServerException('Login failed');
    }

    return result2.id;
  }

  async logout(token: string): Promise<void> {
    await this.dbv4.post<void>('authentication/logout', {
      id: token,
    });
  }

  async createSession(token: string): Promise<RawSession> {
    this.logger.debug('Decoding token', { token });

    const { iat } = this.decodeJWT(token);

    const result = await this.dbv4.post<IdOut>('authentication/verifyToken', {
      id: token,
    });

    if (!result.success) {
      this.logger.debug('Failed to find active token in database', { token });
      throw new NoSessionException(
        'Session has not been established',
        'NoSession'
      );
    }

    const session = {
      token,
      issuedAt: DateTime.fromMillis(iat),
      userId: result.id,
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

    const result = await this.dbv4.post<PashOut>(
      'authentication/pashByUserId',
      {
        id: session.userId,
      }
    );

    if (
      !result.error ||
      !(await argon2.verify(result.pash, oldPassword, this.argon2Options))
    ) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const newPasswordHash = await argon2.hash(newPassword, this.argon2Options);

    await this.dbv4.post<PashOut>('authentication/setPassword', {
      id: session.userId,
      password: newPasswordHash,
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const result = await this.dbv4.post<IdOut>('authentication/verifyEmail', {
      email,
    });

    if (!result.success) {
      this.logger.warning('Email not found; Skipping reset email', { email });
      return;
    }

    const token = this.encodeJWT();
    await this.db
      .query()
      .raw(
        `
      CREATE(et:EmailToken{value:$value, token: $token, createdOn:datetime()})
      RETURN et as emailToken
      `,
        {
          value: email,
          token,
        }
      )
      .first();
    await this.email.send(email, ForgotPassword, {
      token,
    });
  }

  async resetPassword({ token, password }: ResetPasswordInput): Promise<void> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH(emailToken: EmailToken{token: $token})
        RETURN emailToken.value as email, emailToken.token as token, emailToken.createdOn as createdOn
        `,
        {
          token: token,
        }
      )
      .first();
    if (!result) {
      throw new InputException('Token is invalid', 'TokenInvalid');
    }
    const createdOn: DateTime = result.createdOn;

    if (createdOn.diffNow().as('days') > 1) {
      throw new InputException('Token has expired', 'TokenExpired');
    }

    const pash = await argon2.hash(password, this.argon2Options);

    await this.db
      .query()
      .raw(
        `
          MATCH(e:EmailToken {token: $token})
          DELETE e
          WITH *
          MATCH (:EmailAddress {value: $email})<-[:email {active: true}]-(user:User)
          OPTIONAL MATCH (user)-[oldPasswordRel:password]->(oldPassword)
          SET oldPasswordRel.active = false
          WITH user
          LIMIT 1
          MERGE (user)-[:password {active: true, createdAt: $createdAt}]->(password:Property)
          SET password.value = $password
          RETURN password
        `,
        {
          token,
          email: result.email,
          password: pash,
          createdAt: DateTime.local(),
        }
      )
      .first();
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

  private get argon2Options() {
    const options: Except<argon2.Options, 'raw'> = {
      secret: this.config.passwordSecret
        ? Buffer.from(this.config.passwordSecret, 'utf-8')
        : undefined,
    };
    // argon doesn't like undefined values even though the types allow them
    return pickBy(options, (v) => v !== undefined);
  }
}
