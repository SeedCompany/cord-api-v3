import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { fromEvent, Observable, race } from 'rxjs';
import { map } from 'rxjs/operators';
import { ServiceUnavailableException } from '~/common';

/**
 * Throws error when response timeouts.
 * This is configured independently on HTTP server via HTTP_SOCKET_TIMEOUT
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response =
      context.getType() !== 'graphql'
        ? context.switchToHttp().getResponse()
        : GqlExecutionContext.create(context).getContext().response;

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
