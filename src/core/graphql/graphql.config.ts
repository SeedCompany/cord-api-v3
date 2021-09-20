import { Injectable } from '@nestjs/common';
import { GqlModuleOptions, GqlOptionsFactory } from '@nestjs/graphql';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ContextFunction,
} from 'apollo-server-core';
import {
  PersistedQueryNotFoundError,
  PersistedQueryNotSupportedError,
  SyntaxError,
  ValidationError,
} from 'apollo-server-errors';
import { Request, Response } from 'express';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { intersection } from 'lodash';
import { sep } from 'path';
import { GqlContextType } from '../../common';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { GraphqlTracingPlugin } from './graphql-tracing.plugin';

const escapedSep = sep === '/' ? '\\/' : '\\\\';
const matchSrcPathInTrace = RegExp(
  `(at (.+ \\()?).+${escapedSep}src${escapedSep}`
);

@Injectable()
export class GraphQLConfig implements GqlOptionsFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly tracing: GraphqlTracingPlugin,
    private readonly versionService: VersionService
  ) {}

  async createGqlOptions(): Promise<GqlModuleOptions> {
    // Apply git hash to Apollo Studio.
    // They only look for env, so applying that way.
    const version = await this.versionService.version;
    if (version.hash) {
      process.env.APOLLO_SERVER_USER_VERSION = version.hash;
    }
    // This is old from v2, remove so Apollo doesn't complain.
    // Once we finish roll out we can remove this.
    delete process.env.APOLLO_GRAPH_VARIANT;

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
      plugins: [ApolloServerPluginLandingPageLocalDefault({ footer: false })],
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
    } else {
      extensions.exception.stacktrace = extensions.exception.stacktrace
        // remove non src frames
        .filter(
          (frame: string) =>
            frame.startsWith('    at') &&
            !frame.includes('node_modules') &&
            !frame.includes('(internal/') &&
            !frame.includes('(node:internal/') &&
            !frame.includes('(<anonymous>)')
        )
        .map((frame: string) =>
          frame
            // Convert absolute path to path relative to src dir
            .replace(matchSrcPathInTrace, (_, group1) => group1)
            // Convert windows paths to unix for consistency
            .replace(/\\\\/, '/')
            .trim()
        );
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
