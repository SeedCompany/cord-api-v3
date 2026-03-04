import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { simpleSwitch } from '@seedcompany/common';
import { fromEvent, type Observable, race } from 'rxjs';
import { map } from 'rxjs/operators';
import { ServiceUnavailableException } from '~/common';

/**
 * Throws error when response timeouts.
 * This is configured independently on HTTP server via HTTP_SOCKET_TIMEOUT
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const getResponse = simpleSwitch(context.getType(), {
      http: () => context.switchToHttp().getResponse(),
      graphql: () => GqlExecutionContext.create(context).getContext().response,
    });
    const response = getResponse?.();
    if (!response) {
      return next.handle();
    }

    const timeout$ = fromEvent(response.raw, 'timeout').pipe(
      map(() => {
        throw new ServiceUnavailableException(
          'Unable to fulfill request in a timely manner',
        );
      }),
    );

    return race(timeout$, next.handle());
  }
}
