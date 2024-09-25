import { Plugin } from '@nestjs/apollo';
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
import { isUUID } from 'class-validator';
import { BehaviorSubject, identity } from 'rxjs';
import { GqlContextType, Session } from '~/common';
import { EdgeDB, OptionsFn } from '~/core/edgedb';
import { HttpMiddleware } from '~/core/http';

@Injectable()
@Plugin()
export class EdgeDBCurrentUserProvider
  implements HttpMiddleware, NestInterceptor
{
  // A map to transfer the options' holder
  // between the creation in middleware and the use in the interceptor.
  private readonly optionsHolderByRequest = new WeakMap<
    Parameters<HttpMiddleware['use']>[0],
    BehaviorSubject<OptionsFn>
  >();

  constructor(private readonly edgedb: EdgeDB) {}

  use: HttpMiddleware['use'] = (req, res, next) => {
    // Create holder to use later to add current user to globals after it is fetched
    const optionsHolder = new BehaviorSubject<OptionsFn>(identity);
    this.optionsHolderByRequest.set(req, optionsHolder);

    // These options should apply to the entire HTTP/GQL operation.
    // Connect middleware is the only place we get a function which has all of
    // this in scope for the use of an ALS context.
    this.edgedb.usingOptions(optionsHolder, next);
  };

  /**
   * Connect the session to the options' holder
   */
  intercept(context: ExecutionContext, next: CallHandler) {
    const type = context.getType<GqlRequestType>();

    if (type === 'graphql') {
      const { request, session$ } =
        GqlExecutionContext.create(context).getContext<GqlContextType>();
      if (request) {
        const optionsHolder = this.optionsHolderByRequest.get(request)!;
        session$.subscribe((session) => {
          this.applyToOptions(session, optionsHolder);
        });
      }
    } else if (type === 'http') {
      const request = context.switchToHttp().getRequest();
      const optionsHolder = this.optionsHolderByRequest.get(request)!;
      const session: Session | undefined = request.session;
      this.applyToOptions(session, optionsHolder);
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
