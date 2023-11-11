import {
  CallHandler,
  ExecutionContext,
  forwardRef,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  GqlExecutionContext,
  GqlContextType as GqlRequestType,
} from '@nestjs/graphql';
import { csv } from '@seedcompany/common';
import { isUUID } from 'class-validator';
import { Request } from 'express';
import { GraphQLResolveInfo } from 'graphql';
import { from, lastValueFrom } from 'rxjs';
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
import { EdgeDB } from '~/core/edgedb';
import { rolesForScope } from '../authorization';
import { AuthenticationService } from './authentication.service';

@Injectable()
export class SessionInterceptor implements NestInterceptor {
  constructor(
    @Inject(forwardRef(() => AuthenticationService))
    private readonly auth: AuthenticationService & {},
    private readonly config: ConfigService,
    private readonly edgeDB: EdgeDB,
  ) {}

  async intercept(executionContext: ExecutionContext, next: CallHandler) {
    const type = executionContext.getType<GqlRequestType>();
    let session: Session | undefined;
    if (type === 'graphql') {
      session = await this.handleGql(executionContext);
    } else if (type === 'http') {
      session = await this.handleHttp(executionContext);
    }
    // TODO temporarily check if UUID before applying global.
    // Once migration is complete this can be removed.
    const currentUserId =
      session?.userId && isUUID(session.userId) ? session.userId : undefined;
    return from(
      this.edgeDB.withOptions(
        (options) => options.withGlobals({ currentUserId }),
        async () => await lastValueFrom(next.handle()),
      ),
    );
  }

  private async handleHttp(executionContext: ExecutionContext) {
    const enabled = Reflect.getMetadata(
      'SESSION_WATERMARK',
      executionContext.getClass(),
      executionContext.getHandler().name,
    );
    if (!enabled) {
      return;
    }
    const request = executionContext.switchToHttp().getRequest();
    return (request.session = await this.hydrateSession({ request }));
  }

  private async handleGql(executionContext: ExecutionContext) {
    const gqlExecutionContext = GqlExecutionContext.create(executionContext);
    const ctx = gqlExecutionContext.getContext<GqlContextType>();
    const info = gqlExecutionContext.getInfo<GraphQLResolveInfo>();

    if (!ctx.session && info.fieldName !== 'session') {
      return (ctx.session = await this.hydrateSession(ctx));
    }
    return undefined;
  }

  async hydrateSession(context: Pick<GqlContextType, 'request'>) {
    const token = this.getTokenFromContext(context);
    if (!token) {
      throw new UnauthenticatedException();
    }
    const impersonatee = this.getImpersonateeFromContext(context);
    return await this.auth.resumeSession(token, impersonatee);
  }

  getTokenFromContext(context: Pick<GqlContextType, 'request'>): string | null {
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

  getImpersonateeFromContext(
    context: Pick<GqlContextType, 'request'>,
  ): Session['impersonatee'] {
    const user = context.request?.headers?.['x-cord-impersonate-user'] as
      | ID
      | undefined;
    if (user && !isIdLike(user)) {
      throw new InputException(
        `Invalid user ID given in "X-CORD-Impersonate-User" header`,
      );
    }

    const roles = csvHeader(
      context.request?.headers?.['x-cord-impersonate-role'],
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
  if (Role.has(role)) {
    return role;
  }
  throw new InputException(
    `Invalid role "${role}" from "X-CORD-Impersonate-Role" header`,
  );
};

function csvHeader(headerVal: Many<string> | undefined) {
  if (!headerVal) {
    return undefined;
  }
  const items = many(headerVal).flatMap((itemCsv) => csv(itemCsv ?? ''));
  return items && items.length > 0 ? items : undefined;
}
