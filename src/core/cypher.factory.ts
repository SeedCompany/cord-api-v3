import { FactoryProvider } from '@nestjs/common/interfaces';
import { Connection } from 'cypher-query-builder';
import { ConfigService } from './config/config.service';

export const CypherFactory: FactoryProvider<Connection> = {
  provide: Connection,
  useFactory: (config: ConfigService) => {
    const { url, username, password, driverConfig } = config.neo4j;
    const conn = new Connection(url, { username, password }, { driverConfig });
    return conn;
  },
  inject: [ConfigService],
};
