import { FactoryProvider } from '@nestjs/common/interfaces';
import { stripIndent } from 'common-tags';
import { Connection } from 'cypher-query-builder';
import Session from 'neo4j-driver/types/v1/session';
import { ConfigService } from '..';
import { jestSkipFileInExceptionSource } from '../jest-skip-source-file';
import { ILogger, LoggerToken, LogLevel } from '../logger';
import { createBetterError, isNeo4jError } from './errors';
import { ParameterTransformer } from './parameter-transformer.service';
import { MyTransformer } from './transformer';
import './transaction'; // import our transaction augmentation
import './query.overrides'; // import our query augmentation

export const CypherFactory: FactoryProvider<Connection> = {
  provide: Connection,
  useFactory: (
    config: ConfigService,
    parameterTransformer: ParameterTransformer,
    logger: ILogger,
    driverLogger: ILogger
  ) => {
    const { url, username, password, driverConfig } = config.neo4j;
    const conn = new Connection(
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
              driverLogger.log(level, message);
            },
          },
        },
      }
    );

    // wrap session.run calls to add logging
    /* eslint-disable @typescript-eslint/unbound-method */
    const origSession = conn.session;
    conn.session = function (this: never) {
      const session: Session | null = origSession.call(conn);
      if (session) {
        const origRun = session.run;
        session.run = function (this: never, origStatement, parameters, conf) {
          const statement = stripIndent(origStatement.slice(0, -1)) + ';';
          logger.debug('Executing query', {
            statement,
            ...parameters,
          });

          const params = parameters
            ? parameterTransformer.transform(parameters)
            : undefined;
          const result = origRun.call(session, statement, params, conf);

          const origSubscribe = result.subscribe;
          result.subscribe = function (this: never, observer) {
            if (observer.onError) {
              const onError = observer.onError;
              observer.onError = (e) => {
                const patched = jestSkipFileInExceptionSource(e, __filename);
                const mapped = createBetterError(patched);
                if (isNeo4jError(mapped) && mapped.logProps) {
                  logger.log(mapped.logProps);
                }
                onError(mapped);
              };
            }
            origSubscribe.call(result, observer);
          };

          return result;
        };
      }
      /* eslint-enable @typescript-eslint/unbound-method */

      return session;
    };

    // inject logger so transactions can use it
    (conn as any).logger = logger;

    // Replace transformer with our own
    (conn as any).transformer = new MyTransformer();

    return conn;
  },
  inject: [
    ConfigService,
    ParameterTransformer,
    LoggerToken('database:query'),
    LoggerToken('database:driver'),
  ],
};
