import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Connection } from 'cypher-query-builder';
import { ConfigService } from '~/core/config';
import { TransactionHooks, TransactionRetryInformer } from '~/core/database';
import { ConfigModule } from '../config/config.module';
import { TracingModule } from '../tracing';
import { CypherFactory } from './cypher.factory';
import { DatabaseService } from './database.service';
import { IndexerModule } from './indexer/indexer.module';
import { MigrationModule } from './migration/migration.module';
import { ParameterTransformer } from './parameter-transformer.service';
import { Neo4jTransactionalMutationsInterceptor as TransactionalMutationsInterceptor } from './transactional-mutations.interceptor';

@Module({
  imports: [IndexerModule, MigrationModule, ConfigModule, TracingModule],
  providers: [
    CypherFactory,
    DatabaseService,
    ParameterTransformer,
    { provide: APP_INTERCEPTOR, useClass: TransactionalMutationsInterceptor },
    TransactionHooks,
    TransactionRetryInformer,
  ],
  exports: [
    CypherFactory,
    DatabaseService,
    IndexerModule,
    TransactionHooks,
    TransactionRetryInformer,
    MigrationModule,
  ],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    private readonly db: Connection,
    private readonly dbService: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationShutdown() {
    // migration-todo: drop this cleanup along with the Neo4j engine code.
    // The ephemeral test database only exists when the suite actually ran
    // against Neo4j; under another engine this dials a server that local
    // setups no longer run.
    if (this.config.databaseEngine === 'neo4j' && this.config.neo4j.ephemeral) {
      if (this.config.jest) {
        await this.dbService.dropStaleTestDbs();
      }
      await this.dbService.dropDb();
    }
    await this.db.close();
  }
}
