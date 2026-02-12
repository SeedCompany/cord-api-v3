import { catchError, EMPTY, type MonoTypeOperatorFunction } from 'rxjs';
import { NotFoundException } from '~/common/exceptions';

export const omitNotFound$ = <T>(): MonoTypeOperatorFunction<T> =>
  catchError((e) => {
    if (e instanceof NotFoundException) {
      return EMPTY;
    }
    throw e;
  });
