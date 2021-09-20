import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphqlModule } from '@nestjs/graphql';
import { TracingModule } from '../tracing';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';
import { GraphQLConfig } from './graphql.config';

@Module({
  imports: [TracingModule],
  providers: [GraphQLConfig, GraphqlLoggingPlugin, GraphqlTracingPlugin],
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
