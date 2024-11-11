import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AsyncLocalStorage } from 'async_hooks';
import { isUUID } from 'class-validator';
import { BehaviorSubject, identity } from 'rxjs';
import { Session } from '~/common';
import { EdgeDB, OptionsFn } from '~/core/edgedb';
import { GlobalHttpHook } from '~/core/http';

/**
 * This sets the currentUser EdgeDB global based on
 * - GQL: {@link GqlContextType.session$} (updates to this will also be carried forward here)
 * - HTTP: {@link IRequest.session}
 */
@Injectable()
export class EdgeDBCurrentUserProvider implements NestInterceptor {
  constructor(private readonly edgedb: EdgeDB) {}

  // Storage for the current options' holder layer
  private readonly currentHolder = new AsyncLocalStorage<
    BehaviorSubject<OptionsFn>
  >();

  @GlobalHttpHook()
  onRequest(...[_req, _reply, next]: Parameters<GlobalHttpHook>) {
    this.usingOptionsLayer(next);
  }

  usingOptionsLayer<R>(next: () => R): R {
    // Create a holder to use later to add the current user to globals after it is fetched
    const optionsHolder = new BehaviorSubject<OptionsFn>(identity);

    // Set this holder as the current holder for the current request.
    return this.currentHolder.run(optionsHolder, () =>
      // Add these options to the EdgeDB options context.
      // These options should apply to the entire HTTP/GQL operation.
      this.edgedb.usingOptions(optionsHolder, next),
    );
  }

  /**
   * Connect the session to the options' holder
   */
  intercept(context: ExecutionContext, next: CallHandler) {
    const optionsHolder = this.currentHolder.getStore();
    if (!optionsHolder) {
      throw new Error('Current user options holder is not in async context');
    }
    this.getSession(context)?.subscribe((session) => {
      this.applyToOptions(session, optionsHolder);
    });
    return next.handle();
  }

  private getSession(context: ExecutionContext) {
    const type = context.getType();
    if (type === 'graphql') {
      const { session$ } = GqlExecutionContext.create(context).getContext();
      return session$;
    }
    if (type === 'http') {
      const request = context.switchToHttp().getRequest();
      return new BehaviorSubject(request.session);
    }
    return undefined;
  }

  private applyToOptions(
    session: Session | undefined,
    optionsHolder: BehaviorSubject<OptionsFn>,
  ) {
    // TODO temporarily check if UUID before applying global.
    // Once migration is complete this can be removed.
    const currentActorId =
      session?.userId && isUUID(session.userId) ? session.userId : undefined;
    optionsHolder.next((options) =>
      currentActorId ? options.withGlobals({ currentActorId }) : options,
    );
  }
}
