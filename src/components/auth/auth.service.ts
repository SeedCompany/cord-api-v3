import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Connection } from 'cypher-query-builder';
import { verify, sign } from 'jsonwebtoken';
import { DateTime } from 'luxon';
import {
  ConfigService,
  ILogger,
  Logger,
  OnIndex,
  OnIndexParams,
} from '../../core';
import { ISession } from './session';
import { LoginInput, LoginOutput, ResetInput } from './auth.dto';
import { UserEmailInput } from '../user';
import { SesService } from '../../core'
import { EnvironmentService } from '../../core/config/environment.service';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: Connection,
    private readonly config: ConfigService,
    private readonly sesService: SesService,
    private readonly env: EnvironmentService,
    @Logger('auth:service') private readonly logger: ILogger,
  ) {}

  @OnIndex()
  async createIndexes({ db, logger }: OnIndexParams) {}

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
        },
      )
      .first();
    if (!result) {
      throw new Error('Could not save session token to database');
    }

    return result.token;
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
        },
      )
      .first();

    try {
      if (result1 === undefined) {
        throw Error('Email or Password are incorrect');
      }
      if (await argon2.verify(result1.pash, input.password)) {
        // password match
      } else {
        // password did not match
        throw Error('Email or Password are incorrect');
      }
    } catch (err) {
      // internal failure
      console.log(err);
      throw err;
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
          CREATE
            (user)-[:token {active: true, createdAt: datetime()}]->(token)
          RETURN
            user.id as id
        `,
        {
          token: session.token,
          email: input.email,
        },
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
        },
      )
      .run();
  }

  async decodeAndVerifyToken(token: string): Promise<ISession> {
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
        },
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

  async forget(input: UserEmailInput): Promise<boolean> {
    const token = this.encodeJWT();
    const email = input.email;

    await this.db
      .query()
      .raw(
      `
      CREATE(et:EmailToken{value:$value, token: $token, createdOn:datetime()})
      RETURN et as emailToken
      `,
      {
        $value: email,
        $token: token
      }
      )
      .first()
    const params = {
      Destination: { ToAddresses: ["leopard3551@gmail.com"] },
      Message: {
          Body: {
              Html: {
                  Charset: 'UTF-8',
                  Data: `<html><body><p>This is your secret login code:</p>
                          <a href="http://localhost:3333/auth/reset?token=${token}">Go to Login</a></body></html>`
              },
              Text: {
                  Charset: 'UTF-8',
                  Data: `http://localhost:3333/auth/reset?token=${token}`
              }
          },
          Subject: {
              Charset: 'UTF-8',
              Data: 'Forget Password'
          }
      },
      Source: this.env.string("SOURCE_EMAIL").optional("core-field")
    };

    this.sesService.sendEmail(params);
    
    return true;
  }

  async reset(input: ResetInput): Promise<boolean> {
    const checkDate = new Date();
    const { token, password } = input

    const result = await this.db
      .query()
      .raw(
        `
        MATCH(emailToken: EmailToken{token: $token})
        RETURN emailToken.value as email, emailToken.token as token, emailToken.createdOn as createdOn
        `,
        {
          $token: token 
        }
      )
      .first()
    if(result){
      await this.db
        .query()
        .raw(
          `
          MATCH(e:EmailToken{token: $token})
          DELETE e WITH * OPTIONAL MATCH(:EmailAddress{active: true, value:"test@test.com"})<-[:email{active:true}]-(user:User{active:true})-[:password{active:true}]->(password:Property{active:true})
          SET password.value=$password return password
          `,
          {
            $token: token,
            $password: password
          }
        )
        .first()
      return true;
    }    
    return false;
  }

  async check(token: string): Promise<boolean> {
    const checkDate = new Date();
    const result = await this.db
      .query()
      .raw(
        `
        MATCH(emailToken: EmailToken{token: $token})
        RETURN emailToken.value as email, emailToken.token as token, emailToken.createdOn as createdOn
        `,
        {
          $token: token 
        }
      )
      .first()
    if(result){
      if(Math.abs((checkDate.getTime() - Date.parse(result.createdOn)) / (1000 * 3600)) > 24) return false;
      else return true;
    }
    return false;
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
