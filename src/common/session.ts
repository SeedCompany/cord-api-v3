import {
  ArgumentMetadata,
  Inject,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { Context } from '@nestjs/graphql';
import { Request } from 'express';
import { DateTime } from 'luxon';
import { UnauthenticatedException } from './exceptions';

export interface RawSession {
  readonly token: string;
  readonly issuedAt: DateTime;
  readonly userId?: string;
}

export interface Session extends Required<RawSession> {
  readonly anonymous: boolean;
}

export function loggedInSession(session: RawSession): Session {
  if (!session.userId) {
    throw new UnauthenticatedException('User is not logged in');
  }
  return {
    ...session,
    userId: session.userId,
    anonymous: false,
  };
}

export const anonymousSession = (session: RawSession): Session => ({
  ...session,
  userId: session.userId ?? 'anonuserid',
  anonymous: !session.userId,
});

export const AnonSession = () =>
  Context('request', LazySessionPipe, { transform: anonymousSession });

export const LoggedInSession = () =>
  Context('request', LazySessionPipe, { transform: loggedInSession });

export const SESSION_PIPE_TOKEN = Symbol('SessionPipe');

@Injectable()
class LazySessionPipe implements PipeTransform<Request, Promise<RawSession>> {
  constructor(
    @Inject(SESSION_PIPE_TOKEN) private readonly pipe: LazySessionPipe
  ) {}

  transform(request: Request, metadata: ArgumentMetadata): Promise<RawSession> {
    return this.pipe.transform(request, metadata);
  }
}
