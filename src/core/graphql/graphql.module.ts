import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule as NestGraphqlModule } from '@nestjs/graphql';
import { TracingModule } from '../tracing';
import { GqlContextHost, GqlContextHostImpl } from './gql-context.host';
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
  providers: [
    GqlContextHostImpl,
    { provide: GqlContextHost, useExisting: GqlContextHostImpl },
    { provide: APP_INTERCEPTOR, useExisting: GqlContextHostImpl },
  ],
  exports: [NestGraphqlModule, GqlContextHost],
})
export class GraphqlModule implements NestModule {
  constructor(private readonly middleware: GqlContextHostImpl) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(this.middleware.use).forRoutes('*');
  }
}
