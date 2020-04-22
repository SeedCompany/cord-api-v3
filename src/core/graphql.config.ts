import { Injectable } from '@nestjs/common';
import { GqlModuleOptions, GqlOptionsFactory } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
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
      playground: true, // enabled in all environments
      introspection: true, // needed for playground
    };
  }

  context: ContextFunction<{ req: Request; res: Response }, GqlContextType> = ({
    req,
    res,
  }) => ({
    request: req,
    response: res,
  });
}
