import { Inject, Injectable } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { TransactionalMutationsInterceptor } from './abstract-transactional-mutations.interceptor';

@Injectable()
export class Neo4jTransactionalMutationsInterceptor extends TransactionalMutationsInterceptor {
  @Inject(Connection) db: Connection;

  protected async inTx<R>(fn: () => Promise<R>) {
    return await this.db.runInTransaction(fn);
  }
}
