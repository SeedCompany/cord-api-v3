import { Global, Module } from '@nestjs/common';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, EmailModule],
  providers: [AwsS3Factory],
  exports: [AwsS3Factory, ConfigModule, DatabaseModule, EmailModule],
})
export class CoreModule {}
