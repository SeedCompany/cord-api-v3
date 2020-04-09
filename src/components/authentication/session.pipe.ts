import {
  Injectable,
  PipeTransform,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ISession } from '../../common';
import { AuthenticationService } from './authentication.service';

declare module 'express' {
  interface Request {
    session?: ISession;
  }
}

@Injectable()
export class SessionPipe implements PipeTransform<Request, Promise<ISession>> {
  constructor(private readonly auth: AuthenticationService) {}

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
    return this.auth.createSession(token);
  }
}
