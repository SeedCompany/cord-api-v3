/* eslint-disable @typescript-eslint/unified-signatures */
import { Injectable } from '@nestjs/common';
import { $, Executor } from 'edgedb';
import { TypedEdgeQL } from './edgeql';
import { InlineQueryCardinalityMap } from './generated-client/inline-queries';
import { Client } from './reexports';

@Injectable()
export class EdgeDB {
  constructor(private readonly client: Client) {}

  /** Run a query from an edgeql string */
  run<R>(query: TypedEdgeQL<null, R>): Promise<R>;
  /** Run a query from an edgeql string */
  run<Args extends Record<string, any>, R>(
    query: TypedEdgeQL<Args, R>,
    args: Args,
  ): Promise<R>;

  /** Run a query from a edgeql file */
  run<Args, R>(
    query: (client: Executor, args: Args) => Promise<R>,
    args: Args,
  ): Promise<R>;
  /** Run a query from a edgeql file */
  run<R>(query: (client: Executor) => Promise<R>): Promise<R>;

  /** Run a query from the query builder */
  run<R>(query: { run: (client: Executor) => Promise<R> }): Promise<R>;

  async run(query: any, args?: any) {
    if (query instanceof TypedEdgeQL) {
      const cardinality = InlineQueryCardinalityMap.get(query.query);
      if (!cardinality) {
        throw new Error(`Query was not found from inline query generation`);
      }
      const exeMethod = cardinalityToExecutorMethod[cardinality];

      // eslint-disable-next-line @typescript-eslint/return-await
      return await this.client[exeMethod](query.query, args);
    }

    if (query.run) {
      // eslint-disable-next-line @typescript-eslint/return-await
      return await query.run(this.client);
    }

    if (typeof query === 'function') {
      // eslint-disable-next-line @typescript-eslint/return-await
      return await query(this.client, args);
    }

    // For REPL, as this is untyped and assumes many/empty cardinality
    if (typeof query === 'string') {
      return await this.client.query(query, args);
    }

    throw new Error('Could not figure out how to run given query');
  }
}

const cardinalityToExecutorMethod = {
  One: 'queryRequiredSingle',
  AtMostOne: 'querySingle',
  Many: 'query',
  AtLeastOne: 'query',
  Empty: 'query',
} satisfies Record<`${$.Cardinality}`, keyof Executor>;
