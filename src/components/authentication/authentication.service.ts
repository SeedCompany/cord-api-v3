import { Injectable, UnauthorizedException } from '@nestjs/common';
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

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly userService: UserService,
    @Logger('auth:service') private readonly logger: ILogger
  ) {}

  async createToken(): Promise<string> {
    const token = this.encodeJWT();

    const result = await this.db
      .query()
      .raw(
        `
      CREATE
        (token:Token {
          active: true,
          createdAt: datetime(),
          value: $token
        })
      RETURN
        token.value as token
      `,
        {
          token,
        }
      )
      .first();
    if (!result) {
      throw new Error('Could not save session token to database');
    }

    return result.token;
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
    const result1 = await this.db
      .query()
      .raw(
        `
      MATCH
        (token:Token {
          active: true,
          value: $token
        })
      MATCH
        (:EmailAddress {active: true, value: $email})
        <-[:email {active: true}]-
        (user:User {
          active: true
        })
        -[:password {active: true}]->
        (password:Property {active: true})
      RETURN
        password.value as pash
      `,
        {
          token: session.token,
          email: input.email,
        }
      )
      .first();

    if (result1 === undefined) {
      throw Error('Email or Password are incorrect');
    }
    if (!(await argon2.verify(result1.pash, input.password))) {
      throw Error('Email or Password are incorrect');
    }

    const result2 = await this.db
      .query()
      .raw(
        `
          MATCH
            (token:Token {
              active: true,
              value: $token
            }),
            (:EmailAddress {active: true, value: $email})
            <-[:email {active: true}]-
            (user:User {
              active: true
            })
          OPTIONAL MATCH
            (token)-[r]-()
          DELETE r
          CREATE
            (user)-[:token {active: true, createdAt: datetime()}]->(token)
          RETURN
            user.id as id
        `,
        {
          token: session.token,
          email: input.email,
        }
      )
      .first();

    if (result2 === undefined) {
      throw Error('Login failed. Please contact your administrator.');
    }

    return result2.id;
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
    this.logger.debug('Decoding token', { token });

    const { iat } = this.decodeJWT(token);

    // check token in db to verify the user id and owning org id.
    const result = await this.db
      .query()
      .raw(
        `
          MATCH
            (token:Token {
              active: true,
              value: $token
            })
          OPTIONAL MATCH
            (token)<-[:token {active: true}]-(user:User {active: true})
          RETURN
            token, user.owningOrgId AS owningOrgId, user.id AS userId
        `,
        {
          token,
        }
      )
      .first();

    if (!result) {
      this.logger.warning('Failed to find active token in database', { token });
      throw new UnauthorizedException();
    }

    const session = {
      token,
      issuedAt: DateTime.fromMillis(iat),
      owningOrgId: result.owningOrgId,
      userId: result.userId,
    };
    this.logger.debug('Created session', session);
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
      url: `${this.config.resetPasswordURL}?token=${token}`,
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
      throw new Error('Could not find token on database');
    }
    const createdOn: DateTime = result.createdOn;

    if (createdOn.diffNow().as('days') > 1) {
      throw new Error('token has been expired');
    }

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
          password,
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
      throw new UnauthorizedException();
    }

    try {
      return verify(token, this.config.jwtKey) as JwtPayload;
    } catch (e) {
      this.logger.warning('Failed to validate JWT', {
        exception: e,
      });
      throw new UnauthorizedException();
    }
  }
}
