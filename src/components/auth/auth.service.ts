import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { verify, sign } from 'jsonwebtoken';
import { DateTime } from 'luxon';
import {
  DatabaseService,
  ConfigService,
  ILogger,
  ISession,
  Logger,
} from '../../core';
import { CreateTokenOutputDto, LoginUserOutputDto } from './auth.dto';

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('auth:service') private readonly logger: ILogger,
  ) {}

  // CREATE TOKEN
  async createToken(): Promise<CreateTokenOutputDto> {
    const response = new CreateTokenOutputDto();

    const token = this.encodeJWT();

    const session = this.db.driver.session();
    const result = await session.run(
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
    );
    response.token = result.records[0].get('token');
    session.close();
    return response;
  }

  // LOG IN
  async login(password: string, token: string): Promise<LoginUserOutputDto> {
    const response = new LoginUserOutputDto();
    const session = this.db.driver.session();

    const pash = await argon2.hash(password);

    const result = await session.run(
      `
      MATCH
        (token:Token {
          active: true,
          value: $token
        }),
        (user:User {
          active: true,
          password: $pash
        })
      CREATE
        (user)-[:token {createdAt: datetime()}]->(token)
      RETURN
        token.value as token
      `,
      {
        token,
        pash,
      },
    );
    response.success = result.records[0].get('token') === token;
    session.close();
    return response;
  }

  // LOG OUT
  async logout(token: string): Promise<LoginUserOutputDto> {
    const response = new LoginUserOutputDto();
    const session = this.db.driver.session();
    const result = await session.run(
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
    );
    response.success = result.records[0].get('token') === token;
    session.close();
    return response;
  }

  async decodeAndVerifyToken(token?: string): Promise<ISession> {
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
