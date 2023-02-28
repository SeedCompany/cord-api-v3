import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  GqlExecutionContext,
  GqlContextType as GqlExeType,
} from '@nestjs/graphql';
import { Response } from 'express';
import { fromEvent, Observable, race } from 'rxjs';
import { map } from 'rxjs/operators';
import { GqlContextType, ServiceUnavailableException } from '../common';

/**
 * Throws error when response timeouts.
 * This is configured independently on HTTP server via HTTP_SOCKET_TIMEOUT
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response =
      context.getType<GqlExeType>() !== 'graphql'
        ? context.switchToHttp().getResponse<Response>()
        : GqlExecutionContext.create(context).getContext<GqlContextType>()
            .response;

    if (!response) {
      return next.handle();
    }

    const timeout$ = fromEvent(response, 'timeout').pipe(
      map(() => {
        throw new ServiceUnavailableException(
          'Unable to fulfill request in a timely manner',
        );
      }),
    );

    return race(timeout$, next.handle());
  }
}
