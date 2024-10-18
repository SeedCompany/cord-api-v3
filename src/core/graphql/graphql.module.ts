import { ApolloDriver } from '@nestjs/apollo';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule as NestGraphqlModule } from '@nestjs/graphql';
import processUploadRequest, {
  UploadOptions,
} from 'graphql-upload/processRequest.mjs';
import { HttpAdapterHost } from '~/core/http';
import { TracingModule } from '../tracing';
import { GqlContextHost, GqlContextHostImpl } from './gql-context.host';
import { GraphqlErrorFormatter } from './graphql-error-formatter';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphqlSessionPlugin } from './graphql-session.plugin';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';
import { GraphqlOptions } from './graphql.options';

import './types';

const FileUploadOptions: UploadOptions = {};

@Module({
  imports: [TracingModule],
  providers: [
    GraphqlOptions,
    GraphqlErrorFormatter,
    GraphqlLoggingPlugin,
    GraphqlTracingPlugin,
    GraphqlSessionPlugin,
  ],
  exports: [GraphqlOptions],
})
export class GraphqlOptionsModule {}

@Module({
  imports: [
    NestGraphqlModule.forRootAsync({
      driver: ApolloDriver,
      useExisting: GraphqlOptions,
      imports: [GraphqlOptionsModule],
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
  constructor(
    private readonly middleware: GqlContextHostImpl,
    private readonly app: HttpAdapterHost,
  ) {}

  configure(consumer: MiddlewareConsumer) {
    // Always attach our GQL Context middleware.
    // It has its own logic to handle non-gql requests.
    consumer.apply(this.middleware.use).forRoutes('*');

    // Setup file upload handling
    const fastify = this.app.httpAdapter.getInstance();
    const multipartRequests = new WeakSet();
    fastify.addContentTypeParser(
      'multipart/form-data',
      (req, payload, done) => {
        multipartRequests.add(req);
        done(null);
      },
    );
    fastify.addHook('preValidation', async (req, reply) => {
      if (!multipartRequests.has(req) || !req.url.startsWith('/graphql')) {
        return;
      }
      req.body = await processUploadRequest(
        req.raw,
        reply.raw,
        FileUploadOptions,
      );
    });
  }
}
