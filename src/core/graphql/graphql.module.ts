import { Module, type OnModuleInit, type Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  AbstractGraphQLDriver,
  GraphQLModule as NestGraphqlModule,
} from '@nestjs/graphql';
import { mapValues } from '@seedcompany/common';
import { TracingModule } from '../tracing';
import { CleanUpLongLivedConnectionsOnShutdownPlugin } from './clean-up-long-lived-connections-on-shutdown.plugin';
import { DataLoadersInSubscriptionPlugin } from './data-loaders-in-subscription.plugin';
import { Driver } from './driver';
import { GqlContextHost, GqlContextHostImpl } from './gql-context.host';
import { GraphqlErrorFormatter } from './graphql-error-formatter';
import { GraphqlLoggingPlugin } from './graphql-logging.plugin';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';
import { GraphqlOptions } from './graphql.options';

import './normalize-subscription-output';
import './types';

/**
 * Export these plugins for other modules/services to import/inject.
 */
const exportedPlugins: Provider[] = [
  CleanUpLongLivedConnectionsOnShutdownPlugin,
];
@Module(
  mapValues.fromList(['providers', 'exports'], () => exportedPlugins).asRecord,
)
class SharedPluginsModule {}

@Module({
  imports: [TracingModule],
  providers: [
    GraphqlOptions,
    GraphqlErrorFormatter,
    GraphqlLoggingPlugin,
    GraphqlTracingPlugin,
    DataLoadersInSubscriptionPlugin,
  ],
  exports: [GraphqlOptions],
})
export class GraphqlOptionsModule {}

@Module({
  imports: [
    SharedPluginsModule,
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
  exports: [NestGraphqlModule, GqlContextHost, SharedPluginsModule],
})
export class GraphqlModule implements OnModuleInit {
  constructor(private readonly moduleRef: ModuleRef) {}

  onModuleInit() {
    const driver = this.moduleRef.get<Driver>(AbstractGraphQLDriver, {
      strict: false,
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      driver.yoga;
      return;
    } catch {
      //
    }
    // No HTTP server, so the driver wasn't started.
    // Create the Yoga instance now, so it can be accessed outside webserver processes.
    const gqlModule = this.moduleRef.get(NestGraphqlModule, {
      strict: false,
    });
    driver.createYoga(gqlModule.completeOptions!);
  }
}
