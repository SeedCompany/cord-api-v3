import { Global, Module } from '@nestjs/common';
import { AwsS3Factory } from './aws-s3.factory';
import { AwsSESFactory } from './aws-ses.factory';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [AwsS3Factory, AwsSESFactory],
  exports: [AwsS3Factory, AwsSESFactory, ConfigModule, DatabaseModule],
})
export class CoreModule {}
