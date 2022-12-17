import { KeyValueCacheSetOptions } from '@apollo/utils.keyvaluecache/src/KeyValueCache';
import { ApolloDriverConfig } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { GqlOptionsFactory } from '@nestjs/graphql';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
  ContextFunction,
  KeyValueCache,
} from 'apollo-server-core';
import { PersistedQueryOptions } from 'apollo-server-core/src/graphqlOptions';
import {
  PersistedQueryNotFoundError,
  PersistedQueryNotSupportedError,
  SyntaxError,
  ValidationError,
} from 'apollo-server-errors';
import { Request, Response } from 'express';
import {
  GraphQLError,
  GraphQLFormattedError,
  GraphQLScalarType,
  OperationDefinitionNode,
} from 'graphql';
import { intersection } from 'lodash';
import { GqlContextType, mapFromList, ServerException } from '~/common';
import { getRegisteredScalars } from '../../common/scalars';
import { CacheService } from '../cache';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';

@Injectable()
export class GraphQLConfig implements GqlOptionsFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly tracing: GraphqlTracingPlugin,
    private readonly versionService: VersionService
  ) {}

  async createGqlOptions(): Promise<ApolloDriverConfig> {
    // Apply git hash to Apollo Studio.
    // They only look for env, so applying that way.
    const version = await this.versionService.version;
    if (version.hash) {
      process.env.APOLLO_SERVER_USER_VERSION = version.hash;
    }

    const scalars = mapFromList(getRegisteredScalars(), (scalar) =>
      scalar instanceof GraphQLScalarType ? [scalar.name, scalar] : null
    );

    return {
      autoSchemaFile: 'schema.graphql',
      context: this.context,
      cors: this.config.cors,
      playground: false,
      introspection: true,
      formatError: this.formatError,
      debug: this.debug,
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

  get debug() {
    return true; // TODO
  }

  context: ContextFunction<{ req: Request; res: Response }, GqlContextType> = ({
    req,
    res,
  }) => ({
    request: req,
    response: res,
    operation: createFakeStubOperation(),
  });

  formatError = (error: GraphQLError): GraphQLFormattedError => {
    const extensions = { ...error.extensions };

    if (!extensions.codes) {
      extensions.codes = this.resolveCodes(error, extensions.code);
    }

    // Schema & validation errors don't have meaningful stack traces, so remove them
    const worthlessTrace =
      intersection(extensions.codes, ['Validation', 'GraphQL']).length > 0;

    if (!this.debug || worthlessTrace) {
      delete extensions.exception;
    }

    return {
      message: error.message,
      extensions,
      locations: error.locations,
      path: error.path,
    };
  };

  private resolveCodes(error: GraphQLError, code: string): string[] {
    if (
      [
        ValidationError,
        SyntaxError,
        PersistedQueryNotFoundError,
        PersistedQueryNotSupportedError,
      ].some((cls) => error instanceof cls)
    ) {
      return [code, 'GraphQL', 'Client'];
    }
    if (
      error.message.startsWith('Variable ') &&
      [
        /^Variable ".+" got invalid value .+ at ".+"; Field ".+" of required type ".+" was not provided\.$/,
        /^Variable ".+" got invalid value .+ at ".+"; Field ".+" is not defined by type ".+"\..*$/,
        /^Variable ".+" got invalid value .+; Expected type .+.$/,
        /^Variable ".+" of type ".+" used in position expecting type ".+"\.$/,
        /^Variable ".+" of required type ".+" was not provided\.$/,
      ].some((rgx) => rgx.exec(error.message))
    ) {
      return ['GraphQL', 'Client'];
    }
    if (error.message.includes('Cannot return null for non-nullable field')) {
      return [code, 'GraphQL', 'Server'];
    }
    return [code, 'Server'];
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
    private readonly prefix = 'apollo:'
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
