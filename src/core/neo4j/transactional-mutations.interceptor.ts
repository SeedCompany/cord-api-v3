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
export class Neo4jTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  @Inject(TransactionRunner) runner: TransactionRunner;
  @Inject(ConfigService) config: ConfigService;

  async intercept(context: ExecutionContext, next: CallHandler) {
    // migration-todo: this whole file goes away at cutover, along with the
    // engine check. Until then it mirrors the Gel/Drizzle interceptors: all
    // three are registered as APP_INTERCEPTOR, so each must no-op unless it
    // owns the active engine.
    if (this.config.databaseEngine !== 'neo4j') {
      return next.handle();
    }
    return await super.intercept(context, next);
  }

  protected async inTx<R>(fn: () => Promise<R>) {
    return await this.runner.inTx(fn);
  }
}
