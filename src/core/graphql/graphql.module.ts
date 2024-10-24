import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphqlModule } from '@nestjs/graphql';
import { TracingModule } from '../tracing';
import { Driver } from './driver';
import { GqlContextHost, GqlContextHostImpl } from './gql-context.host';
import { GraphqlErrorFormatter } from './graphql-error-formatter';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphqlSessionPlugin } from './graphql-session.plugin';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';
import { GraphqlOptions } from './graphql.options';

import './types';

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
      driver: Driver,
      useExisting: GraphqlOptions,
      imports: [GraphqlOptionsModule],
    }),
  ],
  providers: [
    GqlContextHostImpl,
    { provide: GqlContextHost, useExisting: GqlContextHostImpl },
  ],
  exports: [NestGraphqlModule, GqlContextHost],
})
export class GraphqlModule {}
