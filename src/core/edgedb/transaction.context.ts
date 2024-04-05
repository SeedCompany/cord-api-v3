import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { EdgeDBError, Executor, Session } from 'edgedb';
import { getPreviousList, ServerException } from '~/common';
import { OptionsContext } from './options.context';
import { Client } from './reexports';

@Injectable()
export class TransactionContext
  extends AsyncLocalStorage<Executor>
  implements OnModuleDestroy
{
  constructor(
    private readonly client: Client,
    private readonly optionsContext: OptionsContext,
  ) {
    super();
  }

  async inTx<R>(fn: () => Promise<R>): Promise<R> {
    const errorMap = new WeakMap<Error, Error>();

    const txSession = this.optionsContext.current.session;

    try {
      return await this.client.transaction(async (tx) => {
        const txx = new Proxy(tx, {
          get: (target: typeof tx, p: string, receiver: any) => {
            const current = this.optionsContext.current.session;
            ensureCompatibleSession(txSession, current);
            return Reflect.get(target, p, receiver);
          },
        });

        try {
          return await this.run(txx, fn);
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

function ensureCompatibleSession(txSession: Session, current: Session) {
  // This should work, but is bugged right now.
  // https://github.com/edgedb/edgedb/issues/7138
  // It's hard to reason about, so I'm making sure it errors loud.
  if (
    txSession.config.apply_access_policies !==
    current.config.apply_access_policies
  ) {
    throw new ServerException(
      'Access policies cannot be toggled within a transaction',
    );
  }
}
