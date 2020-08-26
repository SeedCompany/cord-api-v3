import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { sign, verify } from 'jsonwebtoken';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  InputException,
  ISession,
  ServerException,
  UnauthenticatedException,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  EmailService,
  ForgotPassword,
  ILogger,
  Logger,
  matchRequestingUser,
} from '../../core';
import { User, UserService } from '../user';
import { LoginInput, ResetPasswordInput } from './authentication.dto';
import { RegisterInput } from './dto';
import { NoSessionException } from './no-session.exception';

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
    @Logger('authentication:service') private readonly logger: ILogger
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
      throw new ServerException('Failed to start session');
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

    return await this.userService.readOne(userRes.id, session);
  }

  async register(input: RegisterInput, session?: ISession): Promise<string> {
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

    const passwordHash = await argon2.hash(input.password);
    await this.db
      .query()
      .match([
        node('user', 'User', {
          active: true,
          id: userId,
        }),
      ])
      .create([
        node('user'),
        relation('out', '', 'password', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('password', 'Property', {
          active: true,
          value: passwordHash,
        }),
      ])
      .run();

    return userId;
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

    if (!result1 || !(await argon2.verify(result1.pash, input.password))) {
      throw new UnauthenticatedException('Invalid credentials');
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

    if (!result2 || !result2.id) {
      throw new ServerException('Login failed');
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
      .match([
        node('token', 'Token', {
          active: true,
          value: token,
        }),
      ])
      .optionalMatch([
        node('token'),
        relation('in', '', 'token', { active: true }),
        node('user', 'User', { active: true }),
      ])
      .return('token, user.owningOrgId AS owningOrgId, user.id AS userId')
      .first();

    if (!result) {
      this.logger.debug('Failed to find active token in database', { token });
      throw new NoSessionException(
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
    this.logger.debug('Created session', session);
    return session;
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
    session: ISession
  ): Promise<void> {
    const result = await this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('requestingUser'),
        relation('out', '', 'password', { active: true }),
        node('password', 'Property', { active: true }),
      ])
      .return('password.value as passwordHash')
      .first();

    if (!result || !(await argon2.verify(result.passwordHash, oldPassword))) {
      throw new UnauthenticatedException('Invalid credentials');
    }

    const newPasswordHash = await argon2.hash(newPassword);
    await this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('requestingUser'),
        relation('out', '', 'password', { active: true }),
        node('password', 'Property', { active: true }),
      ])
      .setValues({
        'password.value': newPasswordHash,
      })
      .return('password.value as passwordHash')
      .first();
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
      throw new InputException('Token is invalid', 'TokenInvalid');
    }
    const createdOn: DateTime = result.createdOn;

    if (createdOn.diffNow().as('days') > 1) {
      throw new InputException('Token has expired', 'TokenExpired');
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
    } catch (exception) {
      this.logger.warning('Failed to validate JWT', {
        exception,
      });
      throw new UnauthenticatedException(exception);
    }
  }
}
