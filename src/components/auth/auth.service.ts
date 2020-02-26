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

interface JwtPayload {
  iat: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: Connection,
    private readonly config: ConfigService,
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

  async login(
    email: string,
    password: string,
    token: string,
  ): Promise<string | undefined> {
    const pash = await argon2.hash(password);

    const result = await this.db
      .query()
      .raw(
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
        user.id as id
      `,
        {
          token,
          pash,
        },
      )
      .first();

    return result?.id;
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
