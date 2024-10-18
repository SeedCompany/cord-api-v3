import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { ApolloFastifyContextFunctionArgument } from '@as-integrations/fastify';
import { ApolloDriverConfig as DriverConfig } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { GqlOptionsFactory } from '@nestjs/graphql';
import { CacheService } from '@seedcompany/cache';
import { mapKeys } from '@seedcompany/common';
import { GraphQLScalarType, OperationDefinitionNode } from 'graphql';
import { BehaviorSubject } from 'rxjs';
import { GqlContextType, ServerException, Session } from '~/common';
import { getRegisteredScalars } from '~/common/scalars';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { isGqlContext } from './gql-context.host';
import { GraphqlErrorFormatter } from './graphql-error-formatter';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';

@Injectable()
export class GraphqlOptions implements GqlOptionsFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly tracing: GraphqlTracingPlugin,
    private readonly versionService: VersionService,
    private readonly errorFormatter: GraphqlErrorFormatter,
  ) {}

  async createGqlOptions(): Promise<DriverConfig> {
    // Apply git hash to Apollo Studio.
    // They only look for env, so applying that way.
    const version = await this.versionService.version;
    if (version.hash) {
      process.env.APOLLO_SERVER_USER_VERSION = version.hash;
    }

    const scalars = mapKeys.fromList(
      getRegisteredScalars(),
      (scalar, { SKIP }) =>
        scalar instanceof GraphQLScalarType ? scalar.name : SKIP,
    ).asRecord;

    return {
      path: '/graphql/:opName?',
      autoSchemaFile: 'schema.graphql',
      context: this.context,
      playground: false,
      introspection: true,
      formatError: this.errorFormatter.formatError,
      includeStacktraceInErrorResponses: true,
      status400ForVariableCoercionErrors: true, // will be default in v5
      sortSchema: true,
      buildSchemaOptions: {
        fieldMiddleware: [this.tracing.fieldMiddleware()],
      },
      cache: this.cache.adaptTo.apollo({
        ttl: this.config.graphQL.persistedQueries.ttl,
        refreshTtlOnGet: true,
      }),
      persistedQueries: this.config.graphQL.persistedQueries.enabled
        ? {}
        : false,
      resolvers: {
        ...scalars,
      },
      plugins: [
        process.env.APOLLO_GRAPH_REF
          ? ApolloServerPluginLandingPageProductionDefault({
              graphRef: process.env.APOLLO_GRAPH_REF,
              embed: true,
              includeCookies: true,
            })
          : ApolloServerPluginLandingPageLocalDefault({
              embed: true,
              includeCookies: true,
            }),
      ],
    };
  }

  context = (
    ...[request, response]: ApolloFastifyContextFunctionArgument
  ): GqlContextType => ({
    [isGqlContext.KEY]: true,
    request,
    response,
    operation: createFakeStubOperation(),
    session$: new BehaviorSubject<Session | undefined>(undefined),
  });
}

export const createFakeStubOperation = () => {
  const operation = {} as unknown as OperationDefinitionNode;
  return new Proxy(operation, {
    get() {
      throw new ServerException('GQL operation has not been determined yet');
    },
  });
};
