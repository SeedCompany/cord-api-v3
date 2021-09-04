import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  GqlExecutionContext,
  GqlContextType as GqlRequestType,
} from '@nestjs/graphql';
import { Request } from 'express';
import { GqlContextType, UnauthenticatedException } from '../../common';
import { RawSession } from '../../common/session';
import { ConfigService } from '../../core';
import { AuthenticationService } from './authentication.service';

@Injectable()
export class SessionInterceptor implements NestInterceptor {
  constructor(
    private readonly auth: AuthenticationService,
    private readonly config: ConfigService
  ) {}

  async intercept(executionContext: ExecutionContext, next: CallHandler) {
    if (executionContext.getType<GqlRequestType>() !== 'graphql') {
      return next.handle();
    }
    const gqlExecutionContext = GqlExecutionContext.create(executionContext);
    const ctx = gqlExecutionContext.getContext<GqlContextType>();

    if (!ctx.session) {
      ctx.session = await this.hydrateSession(ctx);
    }

    return next.handle();
  }

  async hydrateSession(context: GqlContextType): Promise<RawSession> {
    const token = this.getTokenFromContext(context);
    if (!token) {
      throw new UnauthenticatedException();
    }
    return await this.auth.createSession(token);
  }

  getTokenFromContext(context: GqlContextType): string | null {
    return (
      this.getTokenFromAuthHeader(context.request) ??
      this.getTokenFromCookie(context.request)
    );
  }

  private getTokenFromAuthHeader(req: Request): string | null {
    const header = req?.headers?.authorization;

    if (!header) {
      return null;
    }
    if (!header.startsWith('Bearer ')) {
      return null;
    }

    return header.replace('Bearer ', '');
  }

  private getTokenFromCookie(req: Request): string | null {
    return req?.cookies?.[this.config.sessionCookie.name] || null;
  }
}
