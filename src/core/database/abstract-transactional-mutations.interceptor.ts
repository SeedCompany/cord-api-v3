import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { from, lastValueFrom } from 'rxjs';
import { TransactionHooks } from './transaction-hooks';

/**
 * Run all mutations in a transaction.
 * This allows automatic rollbacks on error.
 */
@Injectable()
export abstract class TransactionalMutationsInterceptor implements NestInterceptor {
  constructor(private readonly txHooks: TransactionHooks) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'graphql') {
      return next.handle();
    }

    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo();
    if (info.operation.operation !== 'mutation') {
      return next.handle();
    }

    return from(
      this.inTx(async () => {
        try {
          return await lastValueFrom(next.handle());
        } catch (e) {
          // Throw away anything this attempt queued to run after a commit.
          //
          // A failed mutation may be retried, and a retry reuses the same
          // GraphQL context — which means the same queues. Without this, a
          // callback registered by an attempt whose writes were rolled back
          // stays queued and runs when a LATER attempt commits. What is queued
          // here is real outbound work: TransactionDeferredTransport puts every
          // mutation's broadcast in this queue, so the effect is a published
          // notification about a change that never happened.
          //
          // Cleared before the rollback callbacks run, so a callback that
          // throws cannot leave stale work behind.
          this.txHooks.afterCommit.clear();
          await this.txHooks.afterRollback.runAndClear();
          throw e;
        }
      }).then(async (res) => {
        await this.txHooks.afterCommit.runAndClear();
        return res;
      }),
    );
  }

  protected abstract inTx<R>(fn: () => Promise<R>): Promise<R>;
}
