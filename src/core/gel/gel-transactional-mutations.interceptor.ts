import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { TransactionalMutationsInterceptor } from '../database/abstract-transactional-mutations.interceptor';
import { TransactionContext } from './transaction.context';

@Injectable()
export class GelTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  @Inject(TransactionContext) context: TransactionContext;
  @Inject(ConfigService) config: ConfigService;

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (this.config.databaseEngine !== 'gel') {
      return next.handle();
    }
    return await super.intercept(context, next);
  }

  protected async inTx<R>(fn: () => Promise<R>) {
    return await this.context.inTx(fn);
  }
}
