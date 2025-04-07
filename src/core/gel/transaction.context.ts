import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { patchMethod } from '@seedcompany/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Executor, GelError, SHOULD_RETRY } from 'gel';
import { getCauseList } from '~/common';
import { TransactionRetryInformer } from '../database/transaction-retry.informer';
import { Client } from './reexports';

@Injectable()
export class TransactionContext
  extends AsyncLocalStorage<Executor>
  implements OnModuleDestroy
{
  constructor(
    private readonly client: Client,
    private readonly retryInformer: TransactionRetryInformer,
  ) {
    super();
  }

  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    const errorMap = new WeakMap<Error, Error>();

    try {
      return await this.client.transaction(async (tx) => {
        try {
          return await this.run(tx, fn);
        } catch (error) {
          // If the error "wraps" an Gel error, then
          // throw that here and save the original.
          // This allows Gel to check if the error is retry-able.
          // If it is, then this error doesn't matter; otherwise we'll unwrap below.
          const maybeRetryableError = getCauseList(error).find(
            (e): e is GelError => e instanceof GelError,
          );
          if (maybeRetryableError) {
            errorMap.set(maybeRetryableError, error);
            const override =
              this.retryInformer.shouldRetry(maybeRetryableError);
            if (override != null) {
              patchMethod(maybeRetryableError, 'hasTag', (base) => (tag) => {
                return tag === SHOULD_RETRY ? override : base(tag);
              });
            }
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
