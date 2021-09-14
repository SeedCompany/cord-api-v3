import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphqlModule } from '@nestjs/graphql';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphQLConfig } from './graphql.config';

@Module({
  providers: [GraphQLConfig, GraphqlLoggingPlugin],
  exports: [GraphQLConfig],
})
export class GraphqlConfigModule {}

@Module({
  imports: [
    NestGraphqlModule.forRootAsync({
      useExisting: GraphQLConfig,
      imports: [GraphqlConfigModule],
    }),
  ],
  exports: [NestGraphqlModule],
})
export class GraphqlModule {}
