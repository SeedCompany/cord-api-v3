import {
  type CallHandler,
  type ExecutionContext,
  forwardRef,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { csv, type FnLike } from '@seedcompany/common';
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
import { Identity } from '~/core/authentication';
import { GlobalHttpHook, type IRequest } from '~/core/http';
import { rolesForScope } from '../../../components/authorization/dto';
import { AuthenticationService } from '../authentication.service';
import { AuthLevel } from './auth-level.decorator';
import { SessionHost } from './session.host';

@Injectable()
export class SessionInterceptor implements NestInterceptor {
  constructor(
    @Inject(forwardRef(() => AuthenticationService))
    private readonly auth: AuthenticationService & {},
    private readonly config: ConfigService,
    private readonly sessionHost: SessionHost,
    private readonly identity: Identity,
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

    const isMutation = this.isMutation(executionContext);
    const authLevel =
      AuthLevel.get(executionContext.getHandler() as FnLike) ??
      AuthLevel.get(executionContext.getClass()) ??
      (isMutation ? 'authenticated' : 'anonymous');

    if (authLevel === 'sessionless') {
      return next.handle();
    }

    const session = await this.startFromContext(executionContext);
    if (session) {
      session$.next(session);
      if (authLevel === 'authenticated') {
        this.identity.verifyLoggedIn();
      }
    }

    return next.handle();
  }

  private isMutation(executionContext: ExecutionContext) {
    switch (executionContext.getType()) {
      case 'graphql': {
        const gqlExecutionContext =
          GqlExecutionContext.create(executionContext);
        const op = gqlExecutionContext.getInfo().operation;
        return op.operation === 'mutation';
      }
      case 'http': {
        const request = executionContext.switchToHttp().getRequest();
        return request.method !== 'GET' && request.method !== 'HEAD';
      }
      default:
        return undefined;
    }
  }

  private async startFromContext(executionContext: ExecutionContext) {
    switch (executionContext.getType()) {
      case 'graphql': {
        const gqlExecutionContext =
          GqlExecutionContext.create(executionContext);
        const ctx = gqlExecutionContext.getContext();
        return await this.hydrateSession(ctx);
      }
      case 'http': {
        const request = executionContext.switchToHttp().getRequest();
        return await this.hydrateSession({ request });
      }
      default:
        return undefined;
    }
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
