import { Global, Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email';
import { GraphQLConfig } from './graphql.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    GraphQLModule.forRootAsync({ useClass: GraphQLConfig }),
  ],
  providers: [AwsS3Factory],
  exports: [AwsS3Factory, ConfigModule, DatabaseModule, EmailModule],
})
export class CoreModule {}
