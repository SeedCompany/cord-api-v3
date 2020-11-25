import { Module, OnApplicationShutdown } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { ConfigModule } from '../config/config.module';
import { CypherFactory } from './cypher.factory';
import { DatabaseService } from './database.service';
import { IndexerModule } from './indexer/indexer.module';
import { ParameterTransformer } from './parameter-transformer.service';
import { DbV4 } from './v4/dbv4.service';

@Module({
  imports: [IndexerModule, ConfigModule],
  providers: [CypherFactory, DatabaseService, ParameterTransformer, DbV4],
  exports: [CypherFactory, DatabaseService, IndexerModule, DbV4],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(private readonly db: Connection) {}

  async onApplicationShutdown() {
    await this.db.close();
  }
}
