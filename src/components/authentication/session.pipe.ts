import { Injectable, PipeTransform } from '@nestjs/common';
import { Request } from 'express';
import type * as core from 'express-serve-static-core';
import { ISession, UnauthenticatedException } from '../../common';
import { ConfigService } from '../../core';
import { AuthenticationService } from './authentication.service';

declare module 'express' {
  interface Request<
    P extends core.Params = core.ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = core.Query
  > extends core.Request<P, ResBody, ReqBody, ReqQuery> {
    session?: ISession;
  }
}

@Injectable()
export class SessionPipe implements PipeTransform<Request, Promise<ISession>> {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly config: ConfigService
  ) {}

  async transform(request: Request): Promise<ISession> {
    if (request?.session) {
      return request.session;
    }

    const session = await this.createSessionFromRequest(request);
    if (!session) {
      throw new UnauthenticatedException();
    }
    request.session = session;

    return session;
  }

  async createSessionFromRequest(req: Request): Promise<ISession | undefined> {
    const token =
      this.getTokenFromAuthHeader(req) || this.getTokenFromCookie(req);

    if (!token) {
      return;
    }

    return await this.auth.createSession(token);
  }

  getTokenFromAuthHeader(req: Request): string | null {
    const header = req?.headers?.authorization;

    if (!header) {
      return null;
    }
    if (!header.startsWith('Bearer ')) {
      return null;
    }

    return header.replace('Bearer ', '');
  }

  getTokenFromCookie(req: Request): string | null {
    return req?.cookies?.[this.config.session.cookieName] || null;
  }
}
