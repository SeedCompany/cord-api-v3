import { Injectable } from '@nestjs/common';
import { GqlModuleOptions, GqlOptionsFactory } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { GqlContextType } from '../common';
import { ConfigService } from './config/config.service';

@Injectable()
export class GraphQLConfig implements GqlOptionsFactory {
  constructor(private readonly config: ConfigService) {}

  async createGqlOptions(): Promise<GqlModuleOptions> {
    return {
      autoSchemaFile: 'schema.graphql',
      context: this.context,
      cors: this.config.cors,
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

    return {
      message: error.message,
      extensions,
      locations: error.locations,
      path: error.path,
    };
  };
}
