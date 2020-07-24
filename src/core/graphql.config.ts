import { Injectable } from '@nestjs/common';
import { GqlModuleOptions, GqlOptionsFactory } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import {
  PersistedQueryNotFoundError,
  PersistedQueryNotSupportedError,
  SyntaxError,
  ValidationError,
} from 'apollo-server-errors';
import { Request, Response } from 'express';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { GqlContextType } from '../common';
import { ConfigService } from './config/config.service';
import { VersionService } from './config/version.service';

@Injectable()
export class GraphQLConfig implements GqlOptionsFactory {
  constructor(
    private readonly config: ConfigService,
    private readonly versionService: VersionService
  ) {}

  async createGqlOptions(): Promise<GqlModuleOptions> {
    // Apply git hash to Apollo Studio.
    // They only look for env, so applying that way.
    const version = await this.versionService.version;
    if (version.hash) {
      process.env.APOLLO_SERVER_USER_VERSION = version.hash;
    }

    return {
      autoSchemaFile: 'schema.graphql',
      context: this.context,
      cors: this.config.cors,
      tracing: true,
      playground: {
        settings: {
          'request.credentials': 'same-origin',
        },
      },
      introspection: true, // needed for playground
      formatError: this.formatError,
      debug: this.debug,
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

    if (!this.debug) {
      delete extensions.exception;
    }

    if (!extensions.codes) {
      extensions.codes = this.resolveCodes(error, extensions.code);
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
    if (error.message.includes('Cannot return null for non-nullable field')) {
      return [code, 'GraphQL', 'Server'];
    }
    return [code, 'Server'];
  }
}
