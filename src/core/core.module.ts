/* eslint-disable */
import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AwsS3Factory } from './aws-s3.factory';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email';
import { ExceptionFilter } from './exception.filter';
import { GraphQLConfig } from './graphql.config';
import { ValidationPipe } from './validation.pipe';
import { QueryModule } from './query/query.module';
import neo4j from 'neo4j-driver';
import { AdminGraphQLConfig } from './query/admin.graphql.config';

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    GraphQLModule.forRootAsync({ useClass: GraphQLConfig }),
    GraphQLModule.forRootAsync({ useClass: AdminGraphQLConfig }),
    QueryModule,
  ],
  providers: [
    AwsS3Factory,
    { provide: APP_FILTER, useClass: ExceptionFilter },
    { provide: APP_PIPE, useClass: ValidationPipe },
  ],
  exports: [AwsS3Factory, ConfigModule, DatabaseModule, EmailModule],
})
export class CoreModule {}
