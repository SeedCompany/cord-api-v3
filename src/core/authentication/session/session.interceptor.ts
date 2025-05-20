import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { type FnLike } from '@seedcompany/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { BehaviorSubject } from 'rxjs';
import { GlobalHttpHook } from '../../http';
import { Identity } from '../identity.service';
import { AuthLevel } from './auth-level.decorator';
import { type Session } from './session.dto';
import { SessionHost } from './session.host';
import { SessionInitiator } from './session.initiator';

@Injectable()
export class SessionInterceptor implements NestInterceptor {
  constructor(
    private readonly sessionInitiator: SessionInitiator,
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

    const request = this.getRequest(executionContext);
    const session = request
      ? await this.sessionInitiator.resume(request)
      : undefined;
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

  private getRequest(executionContext: ExecutionContext) {
    switch (executionContext.getType()) {
      case 'graphql': {
        const gqlExecutionContext =
          GqlExecutionContext.create(executionContext);
        const ctx = gqlExecutionContext.getContext();
        return ctx.request;
      }
      case 'http': {
        const request = executionContext.switchToHttp().getRequest();
        return request;
      }
      default:
        return undefined;
    }
  }
}
