import { FactoryProvider } from '@nestjs/common/interfaces';
import { stripIndent } from 'common-tags';
import { Connection } from 'cypher-query-builder';
import Session from 'neo4j-driver/types/v1/session';
import { ConfigService } from './config/config.service';
import { MyTransformer } from './database-transformer';
import { jestSkipFileInExceptionSource } from './jest-skip-source-file';
import { ILogger, LoggerToken, LogLevel } from './logger';
import './database/transaction'; // import our transaction augmentation

export const CypherFactory: FactoryProvider<Connection> = {
  provide: Connection,
  useFactory: (
    config: ConfigService,
    logger: ILogger,
    driverLogger: ILogger,
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
      },
    );

    // wrap session.run calls to add logging
    const origSession = conn.session;
    conn.session = function(this: never) {
      const session: Session | null = origSession.call(conn);
      if (session) {
        const origRun = session.run;
        session.run = function(this: never, origStatement, parameters, conf) {
          const statement = stripIndent(origStatement);
          logger.debug('\n' + statement, parameters);
          return origRun
            .call(session, statement, parameters, conf)
            .catch(e => {
              throw jestSkipFileInExceptionSource(e, __filename);
            });
        };
      }

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
    LoggerToken('database:query'),
    LoggerToken('database:driver'),
  ],
};
