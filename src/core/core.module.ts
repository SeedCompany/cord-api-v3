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

const neo4jGraphQL = require('neo4j-graphql-js');

const fs = require('fs');
const path = require('path');

const typeDefs = fs
  .readFileSync(
    '/Users/michael_marshall/Documents/dev/cord-api-v3/src/core/query/schema.graphql'
  )
  .toString('utf-8');

const schema = neo4jGraphQL.makeAugmentedSchema({
  typeDefs,
  config: { debug: true },
});

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'asdf')
);

@Global()
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailModule,
    GraphQLModule.forRootAsync({ useClass: GraphQLConfig }),
    GraphQLModule.forRootAsync({
      useFactory: async () => {
        return {
          context: { driver },
          schema,
          path: '/admin',
          // todo: limit to localhost in prod
        };
      },
    }),
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
