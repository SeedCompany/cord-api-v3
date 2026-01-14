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
