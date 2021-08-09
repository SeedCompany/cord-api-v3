import { FactoryProvider } from '@nestjs/common/interfaces';
import { AsyncLocalStorage } from 'async_hooks';
import { stripIndent } from 'common-tags';
import { Connection } from 'cypher-query-builder';
import { compact } from 'lodash';
import { Session, Transaction } from 'neo4j-driver';
// @ts-expect-error this isn't typed but it exists
import TransactionExecutor from 'neo4j-driver/lib/internal/transaction-executor';
import QueryRunner from 'neo4j-driver/types/query-runner';
import { Merge } from 'type-fest';
import { ConfigService } from '..';
import { getPreviousList } from '../../common';
import { jestSkipFileInExceptionSource } from '../jest-skip-source-file';
import { ILogger, LoggerToken, LogLevel } from '../logger';
import { AFTER_MESSAGE } from '../logger/formatters';
import { createBetterError, isNeo4jError } from './errors';
import { ParameterTransformer } from './parameter-transformer.service';
import { MyTransformer } from './transformer';
import './transaction'; // import our transaction augmentation
import './query-augmentation'; // import our query augmentation

// Change transaction retry logic also check all previous exceptions when
// looking for retryable errors.
const canRetryOn = TransactionExecutor._canRetryOn.bind(TransactionExecutor);
TransactionExecutor._canRetryOn = (error?: Error) =>
  error && getPreviousList(error, true).some(canRetryOn);

const csv = (str: string): string[] =>
  compact(str.split(',').map((s) => s.trim()));

const parseRoutingTable = (routingTableStr: string) => {
  const matched =
    /RoutingTable\[database=(.+), expirationTime=(\d+), currentTime=(\d+), routers=\[(.*)], readers=\[(.*)], writers=\[(.*)]]/.exec(
      routingTableStr
    );
  if (!matched) {
    return undefined;
  }
  return {
    database: matched[1] === 'default database' ? null : matched[0],
    expirationTime: parseInt(matched[2], 10),
    currentTime: parseInt(matched[3], 10),
    routers: csv(matched[4]),
    readers: csv(matched[5]),
    writers: csv(matched[6]),
  };
};

export type PatchedConnection = Merge<
  Connection,
  {
    transactionStorage: AsyncLocalStorage<Transaction>;
    logger: ILogger;
    transformer: MyTransformer;
  }
>;

export const CypherFactory: FactoryProvider<Connection> = {
  provide: Connection,
  useFactory: (
    config: ConfigService,
    parameterTransformer: ParameterTransformer,
    logger: ILogger,
    driverLogger: ILogger
  ) => {
    const { url, username, password, driverConfig } = config.neo4j;
    // @ts-expect-error yes we are patching the connection object
    const conn: PatchedConnection = new Connection(
      url,
      { username, password },
      {
        driverConfig: {
          ...driverConfig,
          logging: {
            level: 'debug', // log everything, we'll filter out in our logger
            logger: (neoLevel, message) => {
              const level =
                neoLevel === 'warn' ? LogLevel.WARNING : (neoLevel as LogLevel);
              if (message.startsWith('Updated routing table')) {
                const routingTable = parseRoutingTable(message);
                driverLogger.info('Updated routing table', { routingTable });
              } else if (
                message.startsWith('Routing table is stale for database')
              ) {
                const routingTable = parseRoutingTable(message);
                const matched =
                  /for database: "(.*)" and access mode: "(.+)":/.exec(message);
                driverLogger.info('Routing table is stale', {
                  database: matched?.[1] || null,
                  accessMode: matched?.[2],
                  routingTable,
                });
              } else if (
                level === LogLevel.ERROR &&
                message.includes(
                  'experienced a fatal error {"code":"ServiceUnavailable","name":"Neo4jError"}'
                )
              ) {
                // Change connection failure messages to debug.
                // Connection failures are thrown so they will get logged
                // in exception handling (if they are not handled, i.e. retries/transactions).
                // Otherwise, these are misleading as they aren't actual problems.
                driverLogger.log(LogLevel.DEBUG, message);
              } else {
                driverLogger.log(level, message);
              }
            },
          },
        },
      }
    );

    // Holder for the current transaction using native async storage context.
    conn.transactionStorage = new AsyncLocalStorage();

    // Wrap session call to apply:
    // - transparent transaction handling
    // - query logging
    // - parameter transformation
    // - error transformation
    const origSession = conn.session.bind(conn);
    conn.session = function (this: PatchedConnection) {
      const currentTransaction = this.transactionStorage.getStore();
      if (currentTransaction) {
        // Fake a "session", which is really only used as a QueryRunner,
        // in order to forward methods to the current transaction.
        // @ts-expect-error yes we are only supporting these two methods
        const txSession: Session = {
          run: wrapQueryRun(currentTransaction, logger, parameterTransformer),
          close: async () => {
            // No need to close anything when finishing the query inside of the
            // transaction. The close will happen when the transaction work finishes.
          },
        };
        return txSession;
      }

      const session: Session | null = origSession();
      if (!session) {
        return null;
      }

      session.run = wrapQueryRun(session, logger, parameterTransformer);

      return session;
    };

    // Also tear down transaction storage on close.
    const origClose = conn.close.bind(conn);
    conn.close = async () => {
      await origClose();
      conn.transactionStorage.disable();
    };

    const origCreateQuery = conn.query.bind(conn);
    conn.query = () => {
      const q = origCreateQuery();

      let stack = new Error('').stack?.split('\n').slice(2);
      if (stack?.[0]?.startsWith('    at DatabaseService.query')) {
        stack = stack.slice(1);
      }
      if (!stack) {
        return q;
      }

      (q as any).__stacktrace = stack;

      const origBuild = q.buildQueryObject.bind(q);
      q.buildQueryObject = function () {
        const result = origBuild();
        Object.defineProperty(result.params, '__stacktrace', {
          value: stack?.join('\n'),
          enumerable: false,
          configurable: true,
          writable: true,
        });
        return result;
      };
      return q;
    };

    // inject logger so transactions can use it
    conn.logger = logger;

    // Replace transformer with our own
    conn.transformer = new MyTransformer();

    // @ts-expect-error yes we are patching it back
    return conn as Connection;
  },
  inject: [
    ConfigService,
    ParameterTransformer,
    LoggerToken('database:query'),
    LoggerToken('database:driver'),
  ],
};

const wrapQueryRun = (
  runner: QueryRunner,
  logger: ILogger,
  parameterTransformer: ParameterTransformer
): QueryRunner['run'] => {
  const origRun = runner.run.bind(runner);
  return (origStatement, parameters) => {
    const statement = stripIndent(origStatement.slice(0, -1)) + ';';
    const level = (parameters?.logIt as LogLevel | undefined) ?? LogLevel.DEBUG;
    logger.log(
      level,
      `Executing ${(parameters?.__origin as string | undefined) ?? 'query'}`,
      parameters?.interpolated
        ? { [AFTER_MESSAGE]: parameters.interpolated }
        : { statement, ...parameters }
    );

    const params = parameters
      ? parameterTransformer.transform(parameters)
      : undefined;
    const result = origRun(statement, params);

    const origSubscribe = result.subscribe.bind(result);
    result.subscribe = function (this: never, observer) {
      const onError = observer.onError?.bind(observer);
      observer.onError = (e) => {
        if (typeof parameters?.__stacktrace === 'string' && e.stack) {
          const stackStart = e.stack.indexOf('    at');
          e.stack = e.stack.slice(0, stackStart) + parameters.__stacktrace;
        }
        const patched = jestSkipFileInExceptionSource(e, __filename);
        const mapped = createBetterError(patched);
        if (isNeo4jError(mapped) && mapped.logProps) {
          logger.log(mapped.logProps);
        }
        onError?.(mapped);
      };
      origSubscribe(observer);
    };

    return result;
  };
};
