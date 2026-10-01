import { Injectable } from '@nestjs/common';
import { TransactionalMutationsInterceptor } from '~/core/database/abstract-transactional-mutations.interceptor';
import { TransactionHooks } from '~/core/database/transaction-hooks';
import { TransactionRunner } from '~/core/database/transaction-runner';

@Injectable()
export class DrizzleTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  constructor(
    txHooks: TransactionHooks,
    private readonly runner: TransactionRunner,
  ) {
    super(txHooks);
  }

  protected async inTx<R>(fn: () => Promise<R>): Promise<R> {
    // The TransactionRetryInformer retry loop (markForRetry) lives in the
    // runner, so every caller gets it — not just mutations.
    return await this.runner.inTx(fn);
  }
}
