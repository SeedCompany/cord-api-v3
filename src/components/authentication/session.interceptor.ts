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
import { GraphQLResolveInfo } from 'graphql';
import { compact } from 'lodash';
import {
  GqlContextType,
  ID,
  InputException,
  isIdLike,
  many,
  Many,
  Role,
  Session,
  UnauthenticatedException,
} from '~/common';
import { ConfigService } from '~/core';
import { rolesForScope } from '../authorization';
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
    const info = gqlExecutionContext.getInfo<GraphQLResolveInfo>();

    if (!ctx.session && info.fieldName !== 'session') {
      ctx.session = await this.hydrateSession(ctx);
    }

    return next.handle();
  }

  async hydrateSession(context: GqlContextType) {
    const token = this.getTokenFromContext(context);
    if (!token) {
      throw new UnauthenticatedException();
    }
    const impersonatee = this.getImpersonateeFromContext(context);
    return await this.auth.resumeSession(token, impersonatee);
  }

  getTokenFromContext(context: GqlContextType): string | null {
    return (
      this.getTokenFromAuthHeader(context.request) ??
      this.getTokenFromCookie(context.request)
    );
  }

  private getTokenFromAuthHeader(req: Request | undefined): string | null {
    const header = req?.headers?.authorization;

    if (!header) {
      return null;
    }
    if (!header.startsWith('Bearer ')) {
      return null;
    }

    return header.replace('Bearer ', '');
  }

  private getTokenFromCookie(req: Request | undefined): string | null {
    return req?.cookies?.[this.config.sessionCookie.name] || null;
  }

  private getImpersonateeFromContext(
    context: GqlContextType
  ): Session['impersonatee'] {
    const user = context.request?.headers?.['x-cord-impersonate-user'] as
      | ID
      | undefined;
    if (user && !isIdLike(user)) {
      throw new InputException(
        `Invalid user ID given in "X-CORD-Impersonate-User" header`
      );
    }

    const roles = csvHeader(
      context.request?.headers?.['x-cord-impersonate-role']
    );

    if (!roles && !user) {
      return undefined;
    }

    const scoped = (roles ?? [])
      .map(assertValidRole)
      .map(rolesForScope('global'));

    return { id: user, roles: scoped };
  }
}

const assertValidRole = (role: string): Role => {
  if (Role.all.has(role as Role)) {
    return role as Role;
  }
  throw new InputException(
    `Invalid role "${role}" from "X-CORD-Impersonate-Role" header`
  );
};

function csvHeader(headerVal: Many<string> | undefined) {
  if (!headerVal) {
    return undefined;
  }
  const items = many(headerVal).flatMap((itemCsv) =>
    compact((itemCsv ?? '').split(',').map((role) => role.trim()))
  );
  return items && items.length > 0 ? items : undefined;
}
