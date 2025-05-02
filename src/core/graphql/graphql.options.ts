import { useHive } from '@graphql-hive/yoga';
import { useAPQ } from '@graphql-yoga/plugin-apq';
import { Injectable } from '@nestjs/common';
import { GqlOptionsFactory } from '@nestjs/graphql';
import { CacheService } from '@seedcompany/cache';
import { mapKeys } from '@seedcompany/common';
import {
  DocumentNode,
  GraphQLScalarType,
  OperationDefinitionNode,
} from 'graphql';
import { Plugin as PluginNoContext } from 'graphql-yoga';
import { BehaviorSubject } from 'rxjs';
import { GqlContextType, Session } from '~/common';
import { getRegisteredScalars } from '~/common/scalars';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { apolloExplorer } from './apollo-explorer';
import { DriverConfig, ServerContext } from './driver';
import { isGqlContext } from './gql-context.host';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';

type Plugin = PluginNoContext<GqlContextType>;

@Injectable()
export class GraphqlOptions implements GqlOptionsFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly tracing: GraphqlTracingPlugin,
    private readonly versionService: VersionService,
  ) {}

  async createGqlOptions(): Promise<DriverConfig> {
    // Apply git hash to Apollo Studio.
    // They only look for env, so applying that way.
    const version = await this.versionService.version;
    if (version.hash) {
      process.env.APOLLO_SERVER_USER_VERSION = version.hash;
    }
    const graphRef = process.env.APOLLO_GRAPH_REF;

    const scalars = mapKeys.fromList(
      getRegisteredScalars(),
      (scalar, { SKIP }) =>
        scalar instanceof GraphQLScalarType ? scalar.name : SKIP,
    ).asRecord;

    return {
      path: '/graphql/:opName?',
      autoSchemaFile: 'schema.graphql',
      graphiql: {
        title: graphRef ?? 'CORD@local',
        defaultEditorToolsVisibility: false,
        credentials: 'include',
      },
      renderGraphiQL: () =>
        apolloExplorer({
          title: graphRef ?? 'CORD@local',
          graphRef: graphRef,
          endpointIsEditable: false,
          hideCookieToggle: true,
          initialState: {
            includeCookies: true,
          },
        }),
      context: this.context,
      maskedErrors: false, // Errors are formatted in plugin
      sortSchema: true,
      buildSchemaOptions: {
        fieldMiddleware: [this.tracing.fieldMiddleware()],
      },
      resolvers: {
        ...scalars,
      },
      plugins: [
        this.config.hive.token
          ? useHive({
              token: this.config.hive.token,
              usage: true,
            })
          : false,
        this.useAutomaticPersistedQueries(),
        this.useAddOperationToContext(),
      ],
    };
  }

  context = ({ req: request }: ServerContext): Partial<GqlContextType> => {
    return {
      [isGqlContext.KEY]: true,
      request,
      session$: new BehaviorSubject<Session | undefined>(undefined),
    };
  };

  private useAutomaticPersistedQueries(): PluginNoContext | false {
    const { enabled, ttl } = this.config.graphQL.persistedQueries;
    if (!enabled) {
      return false;
    }

    const store = this.cache.namespace('apq:', { ttl, refreshTtlOnGet: true });
    return useAPQ({ store });
  }

  private useAddOperationToContext(): Plugin {
    return {
      onValidate: ({ params, extendContext }) => {
        const document: DocumentNode = params.documentAST;
        const operation = document.definitions.find(
          (d): d is OperationDefinitionNode => d.kind === 'OperationDefinition',
        )!;
        extendContext({ operation });
      },
    };
  }
}
