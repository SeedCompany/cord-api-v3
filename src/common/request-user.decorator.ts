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
    decoded.token = value; // set raw jwt string to prop so db can use it

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
          token, user.owningOrgId as owningOrgId, user.id as userId
        `,
        {
          token: decoded.token,
        },
      )
      .first();
    if (!result) {
      throw new UnauthorizedException();
    }

    decoded.owningOrgId = result.owningOrgId;
    decoded.userId = result.userId;

    return decoded;
  }
}
