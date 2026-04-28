import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '~/core/config';
import { TransactionalMutationsInterceptor } from '~/core/database/abstract-transactional-mutations.interceptor';
import { TransactionHooks } from '~/core/database/transaction-hooks';
import { DrizzleService } from './drizzle.service';

@Injectable()
export class DrizzleTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  constructor(
    txHooks: TransactionHooks,
    private readonly config: ConfigService,
    private readonly drizzle: DrizzleService,
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
    return await this.drizzle.inTx(fn);
  }
}
