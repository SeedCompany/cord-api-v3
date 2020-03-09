import { Global, Module } from '@nestjs/common';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { CypherFactory } from './database/cypher.factory';
import { DatabaseService } from './database/database.service';
import { IndexerModule } from './database/indexer/indexer.module';
import { DeprecatedDBService } from './deprecated-database.service';

@Global()
@Module({
  imports: [ConfigModule, IndexerModule],
  providers: [
    AwsS3Factory,
    CypherFactory,
    DeprecatedDBService,
    DatabaseService,
  ],
  exports: [
    AwsS3Factory,
    ConfigModule,
    CypherFactory,
    DeprecatedDBService,
    DatabaseService,
  ],
})
export class CoreModule {}
