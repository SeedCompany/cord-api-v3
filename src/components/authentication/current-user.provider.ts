import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { isUUID } from 'class-validator';
import { BehaviorSubject, identity } from 'rxjs';
import { Session } from '~/common';
import { EdgeDB, OptionsFn } from '~/core/edgedb';
import { GlobalHttpHook } from '~/core/http';

@Injectable()
export class EdgeDBCurrentUserProvider implements NestInterceptor {
  // A map to transfer the options' holder
  // between the creation in middleware and the use in the interceptor.
  private readonly optionsHolderByRequest = new WeakMap<
    Parameters<GlobalHttpHook>[0]['raw'],
    BehaviorSubject<OptionsFn>
  >();

  constructor(private readonly edgedb: EdgeDB) {}

  @GlobalHttpHook()
  onRequest(...[req, _reply, next]: Parameters<GlobalHttpHook>) {
    // Create holder to use later to add current user to globals after it is fetched
    const optionsHolder = new BehaviorSubject<OptionsFn>(identity);
    this.optionsHolderByRequest.set(req.raw, optionsHolder);

    // These options should apply to the entire HTTP/GQL operation.
    // Connect middleware is the only place we get a function which has all of
    // this in scope for the use of an ALS context.
    this.edgedb.usingOptions(optionsHolder, next);
  }

  /**
   * Connect the session to the options' holder
   */
  intercept(context: ExecutionContext, next: CallHandler) {
    const type = context.getType();

    if (type === 'graphql') {
      const { request, session$ } =
        GqlExecutionContext.create(context).getContext();
      if (request) {
        const optionsHolder = this.optionsHolderByRequest.get(request.raw)!;
        session$.subscribe((session) => {
          this.applyToOptions(session, optionsHolder);
        });
      }
    } else if (type === 'http') {
      const request = context.switchToHttp().getRequest();
      const optionsHolder = this.optionsHolderByRequest.get(request.raw)!;
      this.applyToOptions(request.session, optionsHolder);
    }

    return next.handle();
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
