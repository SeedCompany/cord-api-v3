import {
  YogaDriverConfig as DriverConfig,
  YogaDriverServerContext,
} from '@graphql-yoga/nestjs';
import { useAPQ } from '@graphql-yoga/plugin-apq';
import { Injectable } from '@nestjs/common';
import { GqlOptionsFactory } from '@nestjs/graphql';
import { CacheService } from '@seedcompany/cache';
import { mapKeys } from '@seedcompany/common';
import { GraphQLScalarType, OperationDefinitionNode } from 'graphql';
import { Plugin } from 'graphql-yoga';
import { BehaviorSubject } from 'rxjs';
import { GqlContextType, ServerException, Session } from '~/common';
import { getRegisteredScalars } from '~/common/scalars';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { isGqlContext } from './gql-context.host';
import { GraphqlErrorFormatter } from './graphql-error-formatter';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';

type ServerContext = YogaDriverServerContext<'fastify'>;

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
      graphiql: {
        title: 'CORD API',
        defaultEditorToolsVisibility: false,
        credentials: 'include',
      },
      context: this.context,
      sortSchema: true,
      buildSchemaOptions: {
        // fieldMiddleware: [this.tracing.fieldMiddleware()],
      },
      resolvers: {
        ...scalars,
      },
      plugins: [
        this.useAutomaticPersistedQueries(),
        // more,
      ],
    };
  }

  context = ({
    req: request,
    reply: response,
  }: ServerContext): GqlContextType => {
    return {
      [isGqlContext.KEY]: true,
      request,
      response,
      operation: createFakeStubOperation(),
      session$: new BehaviorSubject<Session | undefined>(undefined),
    };
  };

  private useAutomaticPersistedQueries(): Plugin | false {
    const { enabled, ttl } = this.config.graphQL.persistedQueries;
    if (!enabled) {
      return false;
    }

    const store = this.cache.namespace('apq:', { ttl, refreshTtlOnGet: true });
    return useAPQ({ store });
  }
}

export const createFakeStubOperation = () => {
  const operation = {} as unknown as OperationDefinitionNode;
  return new Proxy(operation, {
    get() {
      throw new ServerException('GQL operation has not been determined yet');
    },
  });
};
