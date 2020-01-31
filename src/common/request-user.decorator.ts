import {
  applyDecorators,
  ArgumentMetadata,
  PipeTransform,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import { Context } from '@nestjs/graphql';
import { decode, JsonWebTokenError, verify } from 'jsonwebtoken';
import { Connection } from 'cypher-query-builder';
import { IRequestUser } from './request-user.interface';
import { ILogger, Logger, ConfigService } from '../core';

export function RequestUser() {
  return applyDecorators(Context('token', RequiredPipe)) as ParameterDecorator;
}

interface Decoded {
  header: {
    typ: string;
    alg: string;
    kid: string;
  };
  payload: JwtPayload;
  signature: string;
}
interface JwtPayload {
  iss: string;
  sub: string;
  aud: string;
  iat: number;
  exp: number;
  azp: string;
  gty: string;
}

@Injectable()
class RequiredPipe implements PipeTransform {
  constructor(
    private readonly db: Connection,
    private readonly config: ConfigService,
    @Logger('request-user:decorator') private readonly logger: ILogger,
  ) {}

  async transform(
    value: any,
    metadata: ArgumentMetadata,
  ): Promise<IRequestUser> {
    if (!value) {
      throw new UnauthorizedException();
    }

    const decoded = verify(value, this.config.jwtKey) as IRequestUser;

    if (decoded.owningOrdId === null && decoded.userId === null) {
      return decoded; // user isn't logged in, we don't need to hit the db
    } else if (decoded.owningOrdId === null || decoded.userId === null) {
      throw UnauthorizedException; // token is in an invalid state
    }

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
          token, user.owningOrdId as owningOrdId, user.id as userId
        `,
        {
          token: decoded,
        },
      )
      .first();
    if (!result) {
      throw new UnauthorizedException();
    }

    if (
      result.userId !== undefined &&
      (decoded.owningOrdId !== result.owningOrdId ||
        decoded.userId !== result.userId)
    ) {
      return decoded;
    }

    throw UnauthorizedException;
  }
}
