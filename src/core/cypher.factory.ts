import { FactoryProvider } from '@nestjs/common/interfaces';
import { Connection } from 'cypher-query-builder';
import { ConfigService } from './config/config.service';
import { MyTransformer } from './database-transformer';
import { ILogger, LoggerToken, LogLevel } from './logger';
import './database/transaction'; // import our transaction augmentation

export const CypherFactory: FactoryProvider<Connection> = {
  provide: Connection,
  useFactory: (config: ConfigService, logger: ILogger) => {
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
              logger.log(level, message);
            },
          },
        },
      },
    );
    (conn as any).transformer = new MyTransformer();
    return conn;
  },
  inject: [ConfigService, LoggerToken('database:driver')],
};
