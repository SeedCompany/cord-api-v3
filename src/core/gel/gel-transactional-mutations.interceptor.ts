import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '~/core/config';
import { TransactionRunner } from '~/core/database/transaction-runner';
import { TransactionalMutationsInterceptor } from '../database/abstract-transactional-mutations.interceptor';

@Injectable()
export class GelTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  @Inject(TransactionRunner) runner: TransactionRunner;
  @Inject(ConfigService) config: ConfigService;

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (this.config.databaseEngine !== 'gel') {
      return next.handle();
    }
    return await super.intercept(context, next);
  }

  protected async inTx<R>(fn: () => Promise<R>) {
    return await this.runner.inTx(fn);
  }
}
