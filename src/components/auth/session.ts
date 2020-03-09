import {
  applyDecorators,
  Injectable,
  PipeTransform,
  UnauthorizedException,
} from '@nestjs/common';
import { Context } from '@nestjs/graphql';
import { Request } from 'express';
import { DateTime } from 'luxon';
import { AuthService } from './auth.service';

export const Session = () =>
  applyDecorators(Context('request', SessionPipe)) as ParameterDecorator;

// Prefixed with `I` so it can be used in conjunction with decorator
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
export interface ISession {
  token: string;
  issuedAt: DateTime;
  owningOrgId?: string;
  userId?: string;
}

declare module 'express' {
  interface Request {
    session?: ISession;
  }
}

@Injectable()
export class SessionPipe implements PipeTransform {
  constructor(private readonly auth: AuthService) {}

  async transform(request: Request): Promise<ISession> {
    if (request?.session) {
      return request.session;
    }

    const session = await this.createSessionFromRequest(request);
    if (!session) {
      throw new UnauthorizedException();
    }
    request.session = session;

    return session;
  }

  async createSessionFromRequest(req: Request): Promise<ISession | undefined> {
    const header = req?.headers?.authorization;
    if (!header) {
      return;
    }
    if (!header.startsWith('Bearer ')) {
      return;
    }
    const token = header.replace('Bearer ', '');
    return this.auth.decodeAndVerifyToken(token);
  }
}
