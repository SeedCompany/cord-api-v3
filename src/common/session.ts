import {
  ArgumentMetadata,
  Inject,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { Context } from '@nestjs/graphql';
import { Request } from 'express';
import { DateTime } from 'luxon';

export const Session = () => Context('request', LazySessionPipe);

// Prefixed with `I` so it can be used in conjunction with decorator
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface ISession {
  token: string;
  issuedAt: DateTime;
  owningOrgId?: string;
  userId?: string;
}

export const SESSION_PIPE_TOKEN = Symbol('SessionPipe');

@Injectable()
class LazySessionPipe implements PipeTransform<Request, Promise<ISession>> {
  constructor(
    @Inject(SESSION_PIPE_TOKEN) private readonly pipe: LazySessionPipe
  ) {}

  transform(request: Request, metadata: ArgumentMetadata): Promise<ISession> {
    return this.pipe.transform(request, metadata);
  }
}
