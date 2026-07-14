import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '~/core/config';
import { TransactionalMutationsInterceptor } from '~/core/database/abstract-transactional-mutations.interceptor';
import { TransactionHooks } from '~/core/database/transaction-hooks';
import { TransactionRetryInformer } from '~/core/database/transaction-retry.informer';
import { DrizzleService } from './drizzle.service';

@Injectable()
export class DrizzleTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  constructor(
    txHooks: TransactionHooks,
    private readonly config: ConfigService,
    private readonly drizzle: DrizzleService,
    private readonly retryInformer: TransactionRetryInformer,
  ) {
    super(txHooks);
  }

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (this.config.databaseEngine !== 'postgres') {
      return next.handle();
    }
    return await super.intercept(context, next);
  }

  protected async inTx<R>(fn: () => Promise<R>): Promise<R> {
    // Honor TransactionRetryInformer like the Neo4j driver does: handlers
    // (e.g. SetDepartmentId's unique-violation race) mark an error retryable
    // and expect the whole mutation to re-run. Without this loop,
    // markForRetry() is a no-op under postgres. Same semantics as Neo4j
    // retryable transactions: the mutation body may execute multiple times.
    let attemptsLeft = 3;
    // eslint-disable-next-line no-constant-condition,@typescript-eslint/no-unnecessary-condition
    while (true) {
      attemptsLeft--;
      try {
        return await this.drizzle.inTx(fn);
      } catch (error) {
        if (attemptsLeft > 0 && this.markedForRetry(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  private markedForRetry(error: unknown): boolean {
    // The marked error is usually a cause of the thrown one (handlers wrap
    // the db error in a ServerException) — walk the chain.
    let e = error;
    while (e instanceof Error) {
      if (this.retryInformer.shouldRetry(e)) return true;
      e = e.cause;
    }
    return false;
  }
}
