import {
  BadRequestException,
  Injectable,
  InternalServerErrorException as ServerException,
  UnauthorizedException as UnauthenticatedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { sign, verify } from 'jsonwebtoken';
import { DateTime } from 'luxon';
import { ISession } from '../../common';
import {
  ConfigService,
  DatabaseService,
  EmailService,
  ForgotPassword,
  ILogger,
  Logger,
} from '../../core';
import { User, UserService } from '../user';
import { LoginInput, ResetPasswordInput } from './authentication.dto';
import { QueryService } from '../../core/query/query.service';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly db2: QueryService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly userService: UserService,
    @Logger('authentication:service') private readonly logger: ILogger
  ) {}

  async createToken(): Promise<string> {
    const token = this.encodeJWT();
    const createdAt = DateTime.local();
    const writtenToken = await this.db2.createToken(token, createdAt);

    if (!writtenToken) {
      throw new ServerException('Failed to start session');
    }

    return writtenToken;
  }

  async validateToken(token: string): Promise<boolean> {
    this.decodeJWT(token); // it will throw if invalid

    const doesExist = await this.db2.confirmPropertyValueExists(
      ['Token'],
      token
    );

    return doesExist;
  }

  async userFromSession(session: ISession): Promise<User | null> {
    const userRes = await this.db
      .query()
      .match([
        node('token', 'Token', {
          active: true,
          value: session.token,
        }),
        relation('in', '', 'token', {
          active: true,
        }),
        node('user', 'User'),
      ])
      .return({ user: [{ id: 'id' }] })
      .first();

    if (!userRes) {
      return null;
    }

    return this.userService.readOne(userRes.id, session);
  }

  async login(input: LoginInput, session: ISession): Promise<string> {
    const result = await this.db2.login(
      session.token,
      input.email,
      input.password
    );
    return result;
  }

  async logout(token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token)-[r]-()
      DELETE
        r
      RETURN
        token.value as token
      `,
        {
          token,
        }
      )
      .run();
  }

  async createSession(token: string): Promise<ISession> {
    const { iat } = this.decodeJWT(token);
    const result = await this.db2.createSession(token);

    if (!result) {
      this.logger.warning('Failed to find active token in database', { token });
      throw new UnauthenticatedException(
        'Session has not been established',
        'NoSession'
      );
    }

    const session = {
      token,
      issuedAt: DateTime.fromMillis(iat),
      owningOrgId: result.owningOrgId,
      userId: result.userId,
    };
    return session;
  }

  async forgotPassword(email: string): Promise<void> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        (email:EmailAddress {
          value: $email
        })
        RETURN
        email.value as email
        `,
        {
          email: email,
        }
      )
      .first();

    if (!result) {
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
      url: this.config.resetPasswordUrl(token),
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
      throw new BadRequestException('Token is invalid', 'TokenInvalid');
    }
    const createdOn: DateTime = result.createdOn;

    if (createdOn.diffNow().as('days') > 1) {
      throw new BadRequestException('Token has expired', 'TokenExpired');
    }

    const pash = await argon2.hash(password);

    await this.db
      .query()
      .raw(
        `
          MATCH(e:EmailToken {token: $token})
          DELETE e
          WITH *
          OPTIONAL MATCH(:EmailAddress {active: true, value: $email})<-[:email {active: true}]-(user:User {active: true})
                          -[:password {active: true}]->(password:Property {active: true})
          SET password.value = $password
          RETURN password
        `,
        {
          token,
          email: result.email,
          password: pash,
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
    } catch (e) {
      this.logger.warning('Failed to validate JWT', {
        exception: e,
      });
      throw new UnauthenticatedException();
    }
  }
}
