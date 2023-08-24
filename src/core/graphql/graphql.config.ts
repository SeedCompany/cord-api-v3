import { ContextFunction, PersistedQueryOptions } from '@apollo/server';
import { unwrapResolverError } from '@apollo/server/errors';
import { ExpressContextFunctionArgument } from '@apollo/server/express4';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import {
  KeyValueCache,
  KeyValueCacheSetOptions,
} from '@apollo/utils.keyvaluecache';
import { ApolloDriverConfig } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GqlExecutionContext, GqlOptionsFactory } from '@nestjs/graphql';
import {
  GraphQLErrorExtensions as ErrorExtensions,
  GraphQLFormattedError as FormattedError,
  GraphQLError,
  GraphQLScalarType,
  OperationDefinitionNode,
} from 'graphql';
import {
  GqlContextType,
  JsonSet,
  mapFromList,
  ServerException,
} from '~/common';
import { getRegisteredScalars } from '../../common/scalars';
import { CacheService } from '../cache';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { ExceptionFilter } from '../exception/exception.filter';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';

declare module 'graphql/error/GraphQLError' {
  interface GraphQLErrorExtensions {
    code?: string;
    codes?: ReadonlySet<string>;
    stacktrace?: string[];
  }
}

@Injectable()
export class GraphQLConfig implements GqlOptionsFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly tracing: GraphqlTracingPlugin,
    private readonly versionService: VersionService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async createGqlOptions(): Promise<ApolloDriverConfig> {
    // Apply git hash to Apollo Studio.
    // They only look for env, so applying that way.
    const version = await this.versionService.version;
    if (version.hash) {
      process.env.APOLLO_SERVER_USER_VERSION = version.hash;
    }

    const scalars = mapFromList(getRegisteredScalars(), (scalar) =>
      scalar instanceof GraphQLScalarType ? [scalar.name, scalar] : null,
    );

    return {
      autoSchemaFile: 'schema.graphql',
      context: this.context,
      playground: false,
      introspection: true,
      formatError: this.formatError,
      includeStacktraceInErrorResponses: true,
      status400ForVariableCoercionErrors: true, // will be default in v5
      sortSchema: true,
      buildSchemaOptions: {
        fieldMiddleware: [this.tracing.fieldMiddleware()],
      },
      cache: new GraphQLCacheAdapter(this.cache),
      persistedQueries: ((): PersistedQueryOptions | false => {
        const config = this.config.graphQL.persistedQueries;
        const ttl =
          config.ttl.toMillis() <= 0 ? null : config.ttl.as('seconds');
        return config.enabled ? { ttl } : false;
      })(),
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

  context: ContextFunction<[ExpressContextFunctionArgument], GqlContextType> =
    async ({ req, res }) => ({
      request: req,
      response: res,
      operation: createFakeStubOperation(),
    });

  formatError = (
    formatted: FormattedError,
    error: unknown | /* but probably a */ GraphQLError,
  ): FormattedError => {
    const extensions = this.getErrorExtensions(formatted, error);

    const codes = (extensions.codes ??= new JsonSet(['Server']));
    delete extensions.code;

    // Schema & validation errors don't have meaningful stack traces, so remove them
    const worthlessTrace = codes.has('Validation') || codes.has('GraphQL');
    if (worthlessTrace) {
      delete extensions.stacktrace;
    }

    return {
      message: formatted.message,
      extensions,
      locations: formatted.locations,
      path: formatted.path,
    };
  };

  private getErrorExtensions(
    formatted: FormattedError,
    error: unknown | /* but probably a */ GraphQLError,
  ): ErrorExtensions {
    // ExceptionNormalizer has already been called
    if (formatted.extensions?.codes instanceof Set) {
      return { ...formatted.extensions };
    }

    const original = unwrapResolverError(error);
    // Safety check
    if (!(original instanceof Error)) {
      return { ...formatted.extensions };
    }

    // Some errors do not go through the global exception filter.
    // I think ResolveField() calls is one of them.
    // Explicitly call here, so exception is normalized, and errors are logged.
    const fakeGqlContext = new GqlExecutionContext([]);
    fakeGqlContext.setType('graphql');
    let result: Error & { extensions: ErrorExtensions };
    try {
      this.moduleRef
        .get(ExceptionFilter, { strict: false })
        .catch(original, fakeGqlContext);
    } catch (e) {
      result = e;
    }
    return {
      ...result!.extensions,
      stacktrace: result!.stack!.split('\n'),
    };
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

class GraphQLCacheAdapter implements KeyValueCache {
  constructor(
    private readonly cache: CacheService,
    private readonly prefix = 'apollo:',
  ) {}

  async get(key: string): Promise<string | undefined> {
    return await this.cache.get(this.prefix + key, {
      refreshTtlOnGet: true,
    });
  }

  async set(key: string, value: string, options?: KeyValueCacheSetOptions) {
    await this.cache.set(this.prefix + key, value, {
      ttl: options?.ttl ? { seconds: options.ttl } : undefined,
    });
  }

  async delete(key: string) {
    await this.cache.delete(this.prefix + key);
  }
}
