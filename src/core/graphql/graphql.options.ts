import {
  YogaDriverConfig as DriverConfig,
  YogaDriverServerContext,
} from '@graphql-yoga/nestjs';
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
import { fetchApiForYoga } from './fetch-api';
import { isGqlContext } from './gql-context.host';
import { GraphqlErrorFormatter } from './graphql-error-formatter';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';

type Plugin = PluginNoContext<GqlContextType>;
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
      fetchAPI: fetchApiForYoga,
      context: this.context,
      maskedErrors: {
        maskError: this.errorFormatter.formatError,
      },
      sortSchema: true,
      buildSchemaOptions: {
        fieldMiddleware: [this.tracing.fieldMiddleware()],
      },
      resolvers: {
        ...scalars,
      },
      plugins: [
        this.useAutomaticPersistedQueries(),
        this.useAddOperationToContext(),
      ],
    };
  }

  context = ({
    req: request,
    reply: response,
  }: ServerContext): Partial<GqlContextType> => {
    return {
      [isGqlContext.KEY]: true,
      request,
      response,
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
