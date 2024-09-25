import { ApolloDriver } from '@nestjs/apollo';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule as NestGraphqlModule } from '@nestjs/graphql';
import createUploadMiddleware from 'graphql-upload/graphqlUploadExpress.mjs';
import { TracingModule } from '../tracing';
import { GqlContextHost, GqlContextHostImpl } from './gql-context.host';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphqlSessionPlugin } from './graphql-session.plugin';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';
import { GraphQLConfig } from './graphql.config';

import './types';

@Module({
  imports: [TracingModule],
  providers: [
    GraphQLConfig,
    GraphqlLoggingPlugin,
    GraphqlTracingPlugin,
    GraphqlSessionPlugin,
  ],
  exports: [GraphQLConfig],
})
export class GraphqlConfigModule {}

@Module({
  imports: [
    NestGraphqlModule.forRootAsync({
      driver: ApolloDriver,
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
    // Always attach our GQL Context middleware.
    // It has its own logic to handle non-gql requests.
    consumer.apply(this.middleware.use).forRoutes('*');

    // Attach the graphql-upload middleware to the graphql endpoint.
    const uploadMiddleware = createUploadMiddleware();
    consumer.apply(uploadMiddleware).forRoutes('/graphql', '/graphql/*');
  }
}
