import { Global, Module } from '@nestjs/common';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { CypherFactory } from './cypher.factory';
import { DatabaseService } from './database.service';
import { PropertyUpdaterService } from './database/property-updater.service';

@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    AwsS3Factory,
    CypherFactory,
    DatabaseService,
    PropertyUpdaterService,
  ],
  exports: [
    AwsS3Factory,
    ConfigModule,
    CypherFactory,
    DatabaseService,
    PropertyUpdaterService,
  ],
})
export class CoreModule {}
