/* eslint-disable @typescript-eslint/unified-signatures */
import { Injectable, Optional } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { type $, type Executor } from 'gel';
import { type QueryArgs } from 'gel/dist/ifaces';
import { TraceLayer } from '~/common';
import { retry, type RetryOptions } from '~/common/retry';
import { TracingService } from '~/core/tracing';
import { Identity } from '../authentication';
import { TypedEdgeQL } from './edgeql';
import { cleanError } from './errors';
import { InlineQueryRuntimeMap } from './generated-client/inline-queries';
import { type ApplyOptions, OptionsContext } from './options.context';
import { Client } from './reexports';
import { TransactionContext } from './transaction.context';

export const DbTraceLayer = TraceLayer.as('db');

@Injectable()
export class Gel {
  constructor(
    private readonly client: Client,
    private readonly transactionContext: TransactionContext,
    private readonly optionsContext: OptionsContext,
    private readonly tracing: TracingService,
    private readonly identity: Identity,
    @Optional() private readonly childOptions: ApplyOptions[] = [],
    @Optional() private childExecutor?: Executor,
  ) {}

  private clone() {
    return new Gel(
      this.client,
      this.transactionContext,
      this.optionsContext,
      this.tracing,
      this.identity,
      [...this.childOptions],
      this.childExecutor,
    );
  }

  async waitForConnection(options?: RetryOptions) {
    await retry(() => this.client.ensureConnected(), options);
  }

  outsideOfTransactions() {
    const child = this.clone();
    child.childExecutor = this.client;
    return child;
  }

  /**
   * Specialize the service to include these options.
   * Note that these take priority over options defined with {@link usingOptions}
   * @example
   * await Gel
   *   .withOptions((options) => options.withGlobals({ ... }))
   *   .run(...);
   */
  withOptions(applyOptions: ApplyOptions) {
    const child = this.clone();
    child.childOptions.push(applyOptions);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const orig = child.run;
    child.run = ((...args: Parameters<Gel['run']>) =>
      child.childOptions.reduceRight(
        (fn, option) => () => this.optionsContext.usingOptions(option, fn),
        () => orig.apply(child, args),
      )()) as Gel['run'];
    return child;
  }

  /**
   * Apply options to the scope of the given function.
   * @example
   * await Gel.usingOptions((options) => options.withGlobals({ ... }), async () => {
   *   // Queries have the options applied
   *   await Gel.run(...);
   * });
   */
  get usingOptions(): OptionsContext['usingOptions'] {
    return this.optionsContext.usingOptions.bind(this.optionsContext);
  }

  /** Run a query from an edgeql string */
  run<R>(query: TypedEdgeQL<null, R>): Promise<R>;
  /** Run a query from an edgeql string */
  run<Args extends Record<string, any>, R>(
    query: TypedEdgeQL<Args, R>,
    args: Args,
  ): Promise<R>;

  /** Run a query from an edgeql file */
  run<Args, R>(
    query: (client: Executor, args: Args) => Promise<R>,
    args: Args,
  ): Promise<R>;
  /** Run a query from an edgeql file */
  run<R>(query: (client: Executor) => Promise<R>): Promise<R>;

  /** Run a query from the query builder */
  run<R>(query: { run: (client: Executor) => Promise<R> }): Promise<R>;
  run<Args extends object, R>(
    query: {
      run: (client: Executor, args: Args) => Promise<R>;
    },
    args: Args,
  ): Promise<R>;

  /** Run raw EdgeQL without types */
  run(query: string, args?: QueryArgs): Promise<unknown>;

  async run(query: any, args?: any) {
    const queryNames = getCurrentQueryNames();
    const traceName = queryNames?.xray ?? 'Query';

    let currentActorId = this.identity.currentIfInCtx?.userId;
    // TODO temporarily check if UUID before applying global.
    // Once migration is complete this can be removed.
    currentActorId = isUUID(currentActorId) ? currentActorId : undefined;

    return await this.tracing.capture(traceName, async (segment) => {
      // Show this segment separately in the service map
      segment.namespace = 'remote';
      // Help ID the segment as being for a database
      segment.sql = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        database_version: 'Gel',
        user: this.optionsContext.current.globals.get('currentActorId'),
      };

      return await this.usingOptions(
        (opts) => {
          if (queryNames && !opts.tag) {
            opts = opts.withQueryTag(queryNames.gel);
          }
          // TODO sync caching strategy with the solution that resolves
          // https://github.com/geldata/gel-js/issues/1280
          if (currentActorId && !opts.globals.get('currentActorId')) {
            opts = opts.withGlobals({ currentActorId });
          }

          return opts;
        },
        () => this.doRun(query, args),
      );
    });
  }

  private async doRun(query: any, args: any) {
    const executor = this.childExecutor ?? this.transactionContext.current;

    try {
      if (query instanceof TypedEdgeQL) {
        const found = InlineQueryRuntimeMap.get(query.query);
        if (!found) {
          throw new Error(`Query was not found from inline query generation`);
        }
        const exeMethod = cardinalityToExecutorMethod[found.cardinality];

        // eslint-disable-next-line @typescript-eslint/return-await
        return await executor[exeMethod](found.query, args);
      }

      if (query.run) {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await query.run(executor, args);
      }

      if (typeof query === 'function') {
        // eslint-disable-next-line @typescript-eslint/return-await
        return await query(executor, args);
      }

      // For REPL, as this is untyped and assumes many/empty cardinality
      if (typeof query === 'string') {
        return await executor.query(query, args);
      }
    } catch (e) {
      throw cleanError(e);
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

const getCurrentQueryNames = DbTraceLayer.makeGetter(({ cls, method }) => {
  cls = cls.replaceAll(/(Gel|Repository)/g, '');
  return {
    xray: `${cls}.${method}`,
    gel: `cord/${cls}/${method}`,
  };
});
