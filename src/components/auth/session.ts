import {
  applyDecorators,
  ArgumentMetadata,
  PipeTransform,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import { Context } from '@nestjs/graphql';
import { Connection } from 'cypher-query-builder';
import { verify } from 'jsonwebtoken';
import { ILogger, Logger, ConfigService } from '../../core';

export const Session = () =>
  applyDecorators(Context('token', RequiredPipe)) as ParameterDecorator;

export interface ISession {
  token: string;
  iat: number;
  owningOrgId?: string;
  userId?: string;
}

@Injectable()
class RequiredPipe implements PipeTransform {
  constructor(
    private readonly db: Connection,
    private readonly config: ConfigService,
    @Logger('session') private readonly logger: ILogger,
  ) {}

  async transform(value: any, metadata: ArgumentMetadata): Promise<ISession> {
    if (!value) {
      throw new UnauthorizedException();
    }

    const decoded = verify(value, this.config.jwtKey) as ISession;
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
