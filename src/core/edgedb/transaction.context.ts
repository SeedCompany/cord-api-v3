import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { EdgeDBError, Executor } from 'edgedb';
import { getPreviousList } from '~/common';
import { Client } from './reexports';

@Injectable()
export class TransactionContext
  extends AsyncLocalStorage<Executor>
  implements OnModuleDestroy
{
  constructor(private readonly client: Client) {
    super();
  }

  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    const errorMap = new WeakMap<Error, Error>();

    try {
      return await this.client.transaction(async (tx) => {
        try {
          return await this.run(tx, fn);
        } catch (error) {
          // If the error "wraps" an EdgeDB error, then
          // throw that here and save the original.
          // This allows EdgeDB to check if the error is retry-able.
          // If it is, then this error doesn't matter; otherwise we'll unwrap below.
          const maybeRetryableError = getPreviousList(error, true).find(
            (e) => e instanceof EdgeDBError,
          );
          if (maybeRetryableError) {
            errorMap.set(maybeRetryableError, error);
            throw maybeRetryableError;
          }
          throw error;
        }
      });
    } catch (error) {
      // Unwrap the original error if it was wrapped above.
      throw errorMap.get(error) ?? error;
    }
  }

  get current() {
    return this.getStore() ?? this.client;
  }

  onModuleDestroy() {
    this.disable();
  }
}
