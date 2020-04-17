import {
  Injectable,
  PipeTransform,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ISession } from '../../common';
import { ConfigService } from '../../core';
import { AuthenticationService } from './authentication.service';

declare module 'express' {
  interface Request {
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
      throw new UnauthorizedException();
    }
    request.session = session;

    return session;
  }

  async createSessionFromRequest(req: Request): Promise<ISession | undefined> {
    const token =
      this.getTokenFromAuthHeader(req) ||
      this.getTokenFromCookie(req, this.config.session.cookieName);

    if (!token) {
      return;
    }

    return this.auth.createSession(token);
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

  getTokenFromCookie(req: Request, sessionCookieName: string): string | null {
    return req.cookies[sessionCookieName] || null;
  }
}
