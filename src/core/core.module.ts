import { Global, Module } from '@nestjs/common';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { CypherFactory } from './cypher.factory';
import { DatabaseService } from './database.service';

@Global()
@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    AwsS3Factory,
    CypherFactory,
    DatabaseService,
  ],
  exports: [
    AwsS3Factory,
    ConfigModule,
    CypherFactory,
    DatabaseService,
  ],
})
export class CoreModule {}
