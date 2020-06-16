/* eslint-disable */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { GqlModuleOptions, GqlOptionsFactory } from '@nestjs/graphql';
import { ContextFunction } from 'apollo-server-core';
import { Request, Response } from 'express';
import { GraphQLError, GraphQLFormattedError } from 'graphql';

import neo4j from 'neo4j-driver';
import { ConfigService } from '../config/config.service';
import { GqlContextType } from '../../common';

const neo4jGraphQL = require('neo4j-graphql-js');

const fs = require('fs');
const path = require('path');

@Injectable()
export class AdminGraphQLConfig implements GqlOptionsFactory, OnModuleDestroy {
  driver: neo4j.Driver;
  schema: any;
  constructor(private readonly config: ConfigService) {
    const typeDefs = fs
      .readFileSync('./src/core/query/schema.graphql')
      .toString('utf-8');

    this.schema = neo4jGraphQL.makeAugmentedSchema({
      typeDefs,
      config: { debug: false },
      introspection: true,
      playground: true,
    });

    this.driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'asdf')
    );
  }

  onModuleDestroy() {
    this.driver.close();
  }

  async createGqlOptions(): Promise<GqlModuleOptions> {
    return {
      // autoSchemaFile: 'schema.graphql',
      // context: this.context,
      context: { driver: this.driver },
      // cors: this.config.cors,
      // playground: true, // enabled in all environments
      // introspection: true, // needed for playground
      // formatError: this.formatError,
      debug: false,
      schema: this.schema,
      path: '/admin',
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
