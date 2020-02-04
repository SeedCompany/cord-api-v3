import { FactoryProvider } from '@nestjs/common/interfaces';
import { Connection } from 'cypher-query-builder';
import { ConfigService } from './config/config.service';
import { MyTransformer } from './database-transformer';
import './database/transaction'; // import our transaction augmentation

export const CypherFactory: FactoryProvider<Connection> = {
  provide: Connection,
  useFactory: (config: ConfigService) => {
    const { url, username, password, driverConfig } = config.neo4j;
    const conn = new Connection(url, { username, password }, { driverConfig });
    (conn as any).transformer = new MyTransformer();
    return conn;
  },
  inject: [ConfigService],
};
