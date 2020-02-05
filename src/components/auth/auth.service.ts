import { Injectable } from '@nestjs/common';
import { DatabaseService, ConfigService, ILogger, Logger } from '../../core';
import { CreateTokenOutputDto, LoginUserOutputDto } from './auth.dto';
import { generate } from 'shortid';
import { decode, JsonWebTokenError, verify, sign } from 'jsonwebtoken';
import * as argon2 from 'argon2';

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

    const token = sign(
      {
        iat: Date.now(),
      },
      this.config.jwtKey,
    );

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
}
