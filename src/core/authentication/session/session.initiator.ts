import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { csv, setOf } from '@seedcompany/common';
import {
  type ID,
  InputException,
  isIdLike,
  many,
  type Many,
  Role,
  UnauthenticatedException,
} from '~/common';
import { ConfigService } from '~/core/config/config.service';
import { ILogger, Logger } from '~/core/logger';
import { type IRequest } from '../../http';
import { type Session } from './session.dto';
import { type SessionManager } from './session.manager';

/**
 * Extracts identity from incoming requests, and liaisons to SessionManger.
 */
@Injectable()
export class SessionInitiator {
  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => 'SessionManager'))
    private readonly sessionManager: SessionManager & {},
    @Logger('session') private readonly logger: ILogger,
  ) {}

  async start(request: IRequest) {
    const existingToken = this.getToken(request);
    const impersonatee = this.getImpersonatee(request);

    let token = existingToken || (await this.sessionManager.createToken());
    let session;
    try {
      session = await this.sessionManager.resumeSession(token, impersonatee);
    } catch (exception) {
      if (!(exception instanceof UnauthenticatedException)) {
        throw exception;
      }
      this.logger.debug('Failed to use existing session token, creating new one.', { exception });
      token = await this.sessionManager.createToken();
      session = await this.sessionManager.resumeSession(token, impersonatee);
    }

    return session;
  }

  async resume(request: IRequest) {
    const token = this.getToken(request);
    if (!token) {
      throw new UnauthenticatedException();
    }
    const impersonatee = this.getImpersonatee(request);
    return await this.sessionManager.resumeSession(token, impersonatee);
  }

  private getToken(request: IRequest): string | null {
    return this.getTokenFromAuthHeader(request) ?? this.getTokenFromCookie(request);
  }

  private getTokenFromAuthHeader(req: IRequest): string | null {
    const header = req.headers?.authorization;

    if (!header) {
      return null;
    }
    if (!header.startsWith('Bearer ')) {
      return null;
    }

    return header.replace('Bearer ', '');
  }

  private getTokenFromCookie(req: IRequest): string | null {
    return req.cookies?.[this.config.sessionCookie(req).name] || null;
  }

  private getImpersonatee(request: IRequest): Session['impersonatee'] {
    const user = request.headers?.['x-cord-impersonate-user'] as ID | undefined;
    if (user && !isIdLike(user)) {
      throw new InputException(`Invalid user ID given in "X-CORD-Impersonate-User" header`);
    }

    const rawRoles = csvHeader(request?.headers?.['x-cord-impersonate-role']);

    if (!rawRoles && !user) {
      return undefined;
    }

    const roles = setOf((rawRoles ?? []).map(assertValidRole));

    return { id: user, roles };
  }
}

const assertValidRole = (role: string): Role => {
  if (Role.has(role)) {
    return role;
  }
  throw new InputException(`Invalid role "${role}" from "X-CORD-Impersonate-Role" header`);
};

function csvHeader(headerVal: Many<string> | undefined) {
  if (!headerVal) {
    return undefined;
  }
  const items = many(headerVal).flatMap((itemCsv) => csv(itemCsv ?? ''));
  return items && items.length > 0 ? items : undefined;
}
