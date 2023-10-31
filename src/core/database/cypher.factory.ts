import { FactoryProvider } from '@nestjs/common/interfaces';
import { csv } from '@seedcompany/common';
import { AsyncLocalStorage } from 'async_hooks';
import { stripIndent } from 'common-tags';
import { Connection } from 'cypher-query-builder';
import type { Driver, Config as DriverConfig, Session } from 'neo4j-driver';
import type { LoggerFunction } from 'neo4j-driver-core/types/types';
import type QueryRunner from 'neo4j-driver/types/query-runner';
import { Merge } from 'type-fest';
import { fileURLToPath } from 'url';
import { dropSecrets } from '~/common/mask-secrets';
import { ConfigService } from '../config/config.service';
import { jestSkipFileInExceptionSource } from '../exception';
import { ILogger, LoggerToken, LogLevel } from '../logger';
import { AFTER_MESSAGE } from '../logger/formatters';
import { TracingService } from '../tracing';
import {
  createBetterError,
  isNeo4jError,
  ServiceUnavailableError,
} from './errors';
import { highlight } from './highlight-cypher.util';
import { ParameterTransformer } from './parameter-transformer.service';
// eslint-disable-next-line import/no-duplicates
import { Transaction } from './transaction';
import { MyTransformer } from './transformer';
// eslint-disable-next-line import/no-duplicates
import './transaction'; // import our transaction augmentation
import './query-augmentation'; // import our query augmentation

const parseRoutingTable = (routingTableStr: string) => {
  const matched =
    /RoutingTable\[database=(.+), expirationTime=(\d+), currentTime=(\d+), routers=\[(.*)], readers=\[(.*)], writers=\[(.*)]]/.exec(
      routingTableStr,
    );
  if (!matched) {
    return undefined;
  }
  return {
    database: matched[1] === 'default database' ? null : matched[1],
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
    open: boolean;
    driver: Driver;
  }
>;

export const CypherFactory: FactoryProvider<Connection> = {
  provide: Connection,
  useFactory: async (
    config: ConfigService,
    tracing: TracingService,
    parameterTransformer: ParameterTransformer,
    logger: ILogger,
    driverLogger: ILogger,
  ) => {
    const {
      url,
      username,
      password,
      database: databaseNameFromConfig,
      driverConfig,
    } = config.neo4j;

    const driverLoggerAdapter: LoggerFunction = (neoLevel, message) => {
      const level =
        neoLevel === 'warn' ? LogLevel.WARNING : (neoLevel as LogLevel);
      if (message.startsWith('Updated routing table')) {
        const routingTable = parseRoutingTable(message);
        driverLogger.info('Updated routing table', { routingTable });
      } else if (message.startsWith('Routing table is stale for database')) {
        const routingTable = parseRoutingTable(message);
        const matched = /for database: "(.*)" and access mode: "(.+)":/.exec(
          message,
        );
        driverLogger.info('Routing table is stale', {
          database: matched?.[1] || null,
          accessMode: matched?.[2],
          routingTable,
        });
      } else if (
        level === LogLevel.ERROR &&
        message.includes(
          'experienced a fatal error {"code":"ServiceUnavailable","name":"Neo4jError"}',
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
    };

    const resolvedDriverConfig: DriverConfig = {
      ...(driverConfig as DriverConfig), // typecast to undo deep readonly
      logging: {
        level: 'debug', // log everything, we'll filter out in our logger
        logger: driverLoggerAdapter,
      },
    };

    const { auth, driver: driverConstructor } = await import('neo4j-driver');
    const authToken = auth.basic(username, password);

    // @ts-expect-error yes we are patching the connection object
    const conn: PatchedConnection = new Connection(url, authToken, {
      driverConstructor,
      driverConfig: resolvedDriverConfig,
    });

    // Holder for the current transaction using native async storage context.
    conn.transactionStorage = new AsyncLocalStorage();

    // Wrap session call to apply:
    // - transparent transaction handling
    // - query logging
    // - parameter transformation
    // - error transformation
    conn.session = function (this: PatchedConnection) {
      const currentTransaction = this.transactionStorage.getStore();
      if (currentTransaction) {
        // Fake a "session", which is really only used as a QueryRunner,
        // in order to forward methods to the current transaction.
        // @ts-expect-error yes we are only supporting these two methods
        const txSession: Session = {
          run: wrapQueryRun(
            currentTransaction,
            currentTransaction.queryLogger ?? logger,
            parameterTransformer,
          ),
          close: async () => {
            // No need to close anything when finishing the query inside of the
            // transaction. The close will happen when the transaction work finishes.
          },
        };
        return txSession;
      }

      if (!this.open) {
        return null;
      }

      // Assume the default name to workaround routing table cache bug.
      // https://github.com/neo4j/neo4j-javascript-driver/issues/1138
      const resolvedDatabaseName = databaseNameFromConfig || 'neo4j';

      const session = this.driver.session({
        database: resolvedDatabaseName,
      });

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
      const frame = stack?.[0] ? /at (.+) \(/.exec(stack[0]) : undefined;
      (q as any).name = frame?.[1].replace('Repository', '');

      const orig = q.run.bind(q);
      q.run = async () => {
        return await tracing.capture((q as any).name ?? 'Query', (sub) => {
          // Show this segment separately in service map
          sub.namespace = 'remote';
          // Help ID the segment as being for a database
          sub.sql = {};

          const { params } = q.buildQueryObject();
          sub.addMetadata('parameters', dropSecrets(params));

          return orig();
        });
      };

      const origBuild = q.buildQueryObject.bind(q);
      q.buildQueryObject = function () {
        const result = origBuild();
        Object.defineProperty(result.params, '__stacktrace', {
          value: stack?.join('\n'),
          enumerable: false,
          configurable: true,
          writable: true,
        });
        Object.defineProperty(result.params, '__origin', {
          value: (q as any).name,
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
    TracingService,
    ParameterTransformer,
    LoggerToken('database:query'),
    LoggerToken('database:driver'),
  ],
};

const wrapQueryRun = (
  runner: QueryRunner,
  logger: ILogger,
  parameterTransformer: ParameterTransformer,
): QueryRunner['run'] => {
  const origRun = runner.run.bind(runner);
  return (origStatement, parameters) => {
    const statement = stripIndent(origStatement.slice(0, -1)) + ';';
    const level = (parameters?.logIt as LogLevel | undefined) ?? LogLevel.DEBUG;
    logger.log(
      level,
      (parameters?.__origin as string | undefined) ?? 'Query',
      parameters?.interpolated
        ? { [AFTER_MESSAGE]: parameters.interpolated }
        : {
            ...(parameters?.logIt
              ? {
                  statement:
                    process.env.NODE_ENV !== 'production'
                      ? highlight(statement)
                      : statement,
                }
              : {}),
            ...parameters,
          },
    );

    const params = parameters
      ? parameterTransformer.transform(parameters)
      : undefined;
    const result = origRun(statement, params);

    const tweakError = (e: Error) => {
      e = createBetterError(e);
      if (e.stack) {
        const stackStart = e.stack.indexOf('    at');
        if (e instanceof ServiceUnavailableError) {
          // Stack doesn't matter for connection errors, as it's not caused by
          // the specific DB query.
          e.stack = e.stack.slice(0, stackStart).trim();
        } else if (typeof parameters?.__stacktrace === 'string' && e.stack) {
          e.stack = e.stack.slice(0, stackStart) + parameters.__stacktrace;
        }
      }
      jestSkipFileInExceptionSource(e, fileURLToPath(import.meta.url));
      if (isNeo4jError(e) && e.logProps) {
        logger.log(e.logProps);
      }
      return e;
    };

    const origSubscribe = result.subscribe.bind(result);
    result.subscribe = function (this: never, observer) {
      const onError = observer.onError?.bind(observer);
      observer.onError = (e) => {
        const mapped = tweakError(e);
        onError?.(mapped);
      };
      origSubscribe(observer);
    };

    const origSummary = result.summary.bind(result);
    result.summary = async function () {
      try {
        return await origSummary();
      } catch (e) {
        throw tweakError(e);
      }
    };

    return result;
  };
};
