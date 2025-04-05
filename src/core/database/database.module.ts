import { Module, OnApplicationShutdown } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Connection } from 'cypher-query-builder';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { TracingModule } from '../tracing';
import { CypherFactory } from './cypher.factory';
import { DatabaseService } from './database.service';
import { IndexerModule } from './indexer/indexer.module';
import { MigrationModule } from './migration/migration.module';
import { ParameterTransformer } from './parameter-transformer.service';
import { RollbackManager } from './rollback-manager';
import { TransactionRetryInformer } from './transaction-retry.informer';
import { Neo4jTransactionalMutationsInterceptor as TransactionalMutationsInterceptor } from './transactional-mutations.interceptor';

@Module({
  imports: [IndexerModule, MigrationModule, ConfigModule, TracingModule],
  providers: [
    CypherFactory,
    DatabaseService,
    ParameterTransformer,
    { provide: APP_INTERCEPTOR, useClass: TransactionalMutationsInterceptor },
    RollbackManager,
    TransactionRetryInformer,
  ],
  exports: [
    CypherFactory,
    DatabaseService,
    IndexerModule,
    RollbackManager,
    TransactionRetryInformer,
  ],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    private readonly db: Connection,
    private readonly dbService: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationShutdown() {
    if (this.config.neo4j.ephemeral) {
      await this.dbService.dropDb();
    }
    await this.db.close();
  }
}
