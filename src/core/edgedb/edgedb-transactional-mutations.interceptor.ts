import { Inject, Injectable } from '@nestjs/common';
import { TransactionalMutationsInterceptor } from '../database/abstract-transactional-mutations.interceptor';
import { TransactionContext } from './transaction.context';

@Injectable()
export class EdgeDBTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  @Inject(TransactionContext) context: TransactionContext;

  protected async inTx<R>(fn: () => Promise<R>) {
    return await this.context.inTx(fn);
  }
}
