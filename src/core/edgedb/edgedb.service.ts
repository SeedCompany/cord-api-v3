/* eslint-disable @typescript-eslint/unified-signatures */
import { Injectable } from '@nestjs/common';
import { $, Executor } from 'edgedb';
import { retry, RetryOptions } from '~/common/retry';
import { TypedEdgeQL } from './edgeql';
import { ExclusivityViolationError } from './exclusivity-violation.error';
import { InlineQueryCardinalityMap } from './generated-client/inline-queries';
import { OptionsContext, OptionsFn } from './options.context';
import { Client } from './reexports';
import { TransactionContext } from './transaction.context';

@Injectable()
export class EdgeDB {
  constructor(
    private readonly client: Client,
    private readonly executor: TransactionContext,
    private readonly optionsContext: OptionsContext,
  ) {}

  async waitForConnection(options?: RetryOptions) {
    await retry(() => this.client.ensureConnected(), options);
  }

  /**
   * Apply options to the scope of the given function.
   * @example
   * await EdgeDB.withOptions((options) => options.withGlobals({ ... }), async () => {
   *   // Queries have the options applied
   *   await EdgeDB.run(...);
   * });
   */
  async withOptions<R>(applyOptions: OptionsFn, runWith: () => Promise<R>) {
    return await this.optionsContext.withOptions(applyOptions, runWith);
  }

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
  run<Args extends object, R>(
    query: {
      run: (client: Executor, args: Args) => Promise<R>;
    },
    args: Args,
  ): Promise<R>;

  async run(query: any, args?: any) {
    try {
      if (query instanceof TypedEdgeQL) {
        const cardinality = InlineQueryCardinalityMap.get(query.query);
        if (!cardinality) {
          throw new Error(`Query was not found from inline query generation`);
        }
        const exeMethod = cardinalityToExecutorMethod[cardinality];

        return await this.executor.current[exeMethod](query.query, args);
      }

      if (query.run) {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await query.run(this.executor.current, args);
      }

      if (typeof query === 'function') {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await query(this.executor.current, args);
      }

      // For REPL, as this is untyped and assumes many/empty cardinality
      if (typeof query === 'string') {
        return await this.executor.current.query(query, args);
      }
    } catch (e) {
      if (ExclusivityViolationError.is(e)) {
        throw ExclusivityViolationError.cast(e);
      }
      throw e;
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
