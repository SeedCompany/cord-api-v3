import { Module, OnApplicationShutdown } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { DeprecatedDBService } from '../deprecated-database.service';
import { CypherFactory } from './cypher.factory';
import { DatabaseService } from './database.service';
import { IndexerModule } from './indexer/indexer.module';
import { ParameterTransformer } from './parameter-transformer.service';

@Module({
  imports: [IndexerModule],
  providers: [
    CypherFactory,
    DatabaseService,
    DeprecatedDBService,
    ParameterTransformer,
  ],
  exports: [CypherFactory, DatabaseService, DeprecatedDBService, IndexerModule],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly db: Connection) {}

  async onApplicationShutdown() {
    this.db.close();
  }
}
