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
import { GqlOptionsFactory } from '@nestjs/graphql';
import { mapKeys } from '@seedcompany/common';
import {
  GraphQLErrorExtensions as ErrorExtensions,
  GraphQLFormattedError as FormattedError,
  GraphQLError,
  GraphQLScalarType,
  OperationDefinitionNode,
} from 'graphql';
import { BehaviorSubject } from 'rxjs';
import { GqlContextType, JsonSet, ServerException, Session } from '~/common';
import { getRegisteredScalars } from '../../common/scalars';
import { CacheService } from '../cache';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { ExceptionFilter } from '../exception/exception.filter';
import { ExceptionNormalizer } from '../exception/exception.normalizer';
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
  private readonly exceptionNormalizer: ExceptionNormalizer;
  private readonly exceptionFilter: ExceptionFilter;

  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly tracing: GraphqlTracingPlugin,
    private readonly versionService: VersionService,
    moduleRef: ModuleRef,
  ) {
    [this.exceptionNormalizer, this.exceptionFilter] = [
      moduleRef.get(ExceptionNormalizer, { strict: false }),
      moduleRef.get(ExceptionFilter, { strict: false }),
    ];
  }

  async createGqlOptions(): Promise<ApolloDriverConfig> {
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
      session$: new BehaviorSubject<Session | undefined>(undefined),
    });

  formatError = (
    formatted: FormattedError,
    error: unknown | /* but probably a */ GraphQLError,
  ): FormattedError => {
    const { message, ...extensions } = this.getErrorExtensions(
      formatted,
      error,
    );

    const codes = (extensions.codes ??= new JsonSet(['Server']));
    delete extensions.code;

    // Schema & validation errors don't have meaningful stack traces, so remove them
    const worthlessTrace = codes.has('Validation') || codes.has('GraphQL');
    if (worthlessTrace) {
      delete extensions.stacktrace;
    }

    return {
      message:
        message && typeof message === 'string' ? message : formatted.message,
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
    // ResolveField() calls is one of them.
    // Normalized & log here.
    const normalized = this.exceptionNormalizer.normalize({
      ex: original,
      gql: error instanceof GraphQLError ? error : undefined,
    });
    this.exceptionFilter.logIt(normalized, original);
    const { stack, ...extensions } = normalized;
    return {
      ...extensions,
      stacktrace: stack.split('\n'),
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
