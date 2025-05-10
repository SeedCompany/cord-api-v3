import {
  type CallHandler,
  type ExecutionContext,
  forwardRef,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { csv } from '@seedcompany/common';
import { AsyncLocalStorage } from 'async_hooks';
import { BehaviorSubject } from 'rxjs';
import {
  type GqlContextType,
  type ID,
  InputException,
  isIdLike,
  many,
  type Many,
  Role,
  type Session,
  UnauthenticatedException,
} from '~/common';
import { ConfigService } from '~/core';
import { GlobalHttpHook, type IRequest } from '~/core/http';
import { rolesForScope } from '../authorization/dto';
import { AuthenticationService } from './authentication.service';
import { SessionHost } from './session.host';

@Injectable()
export class SessionInterceptor implements NestInterceptor {
  constructor(
    @Inject(forwardRef(() => AuthenticationService))
    private readonly auth: AuthenticationService & {},
    private readonly config: ConfigService,
    private readonly sessionHost: SessionHost,
  ) {}

  private readonly sessionByRequest = new AsyncLocalStorage<
    SessionHost['current$']
  >();

  @GlobalHttpHook()
  onRequest(...[_req, _reply, next]: Parameters<GlobalHttpHook>) {
    // Create a holder to use later to declare the session after it is constructed
    const sessionForTheRequest = new BehaviorSubject<Session | undefined>(
      undefined,
    );
    // Store this as the current holder for the current request.
    // This is our private store, so the code below won't interfere with
    // a different SessionHost context.
    this.sessionByRequest.run(sessionForTheRequest, () =>
      // Also declare this as the session for the entire HTTP/GQL operation.
      // This is what the rest of the codebase pulls from unless it is overridden.
      this.sessionHost.withSession(sessionForTheRequest, next),
    );
  }

  async intercept(executionContext: ExecutionContext, next: CallHandler) {
    const session$ = this.sessionByRequest.getStore();
    if (!session$) {
      throw new Error('Session holder for request is not in async context');
    }

    const type = executionContext.getType();

    let session;
    if (type === 'graphql') {
      session = await this.handleGql(executionContext);
    } else if (type === 'http') {
      session = await this.handleHttp(executionContext);
    }
    session$.next(session);

    return next.handle();
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
    return await this.hydrateSession({ request });
  }

  private async handleGql(executionContext: ExecutionContext) {
    const gqlExecutionContext = GqlExecutionContext.create(executionContext);
    const ctx = gqlExecutionContext.getContext();
    const info = gqlExecutionContext.getInfo();

    if (info.fieldName !== 'session') {
      const session = await this.hydrateSession(ctx);
      return session;
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

  private getTokenFromAuthHeader(req: IRequest | undefined): string | null {
    const header = req?.headers?.authorization;

    if (!header) {
      return null;
    }
    if (!header.startsWith('Bearer ')) {
      return null;
    }

    return header.replace('Bearer ', '');
  }

  private getTokenFromCookie(req: IRequest | undefined): string | null {
    return req?.cookies?.[this.config.sessionCookie(req).name] || null;
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
