import {
  applyDecorators,
  ArgumentMetadata,
  PipeTransform,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import { Context } from '@nestjs/graphql';
import { Connection } from 'cypher-query-builder';
import { RequestUser as IRequestUser } from './request-user';

export function RequestUser() {
  return applyDecorators(Context('token', RequiredPipe)) as ParameterDecorator;
}

// TODO Replace with class-validator and ValidationPipe which hasn't been setup here
@Injectable()
class RequiredPipe implements PipeTransform {
  constructor(
    private readonly db: Connection, // @Logger('user:service') private readonly logger: ILogger,
  ) {}
  async transform(value: any, metadata: ArgumentMetadata): Promise<IRequestUser> {
    // process JWT

    // verify token, userId, and ordId in db

    const result = await this.db
      .query()
      .raw(
        `

        `,
        {},
      )
      .first();
    if (!result) {
      throw new Error('Could not create user');
    }
    if (!value) {
      throw new UnauthorizedException();
    }
    return value;
  }
}
