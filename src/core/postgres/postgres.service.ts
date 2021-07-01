import { Injectable } from '@nestjs/common';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Client, Pool } from 'pg';
import { ConfigService } from '..';

@Injectable()
export class PostgresService {
  constructor(private readonly config: ConfigService) {}
  // pools/clients will use environment variables
  // for connection information
  pool = new Pool();
  client = new Client({
    user: this.config.postgres.user,
    host: this.config.postgres.host,
    database: this.config.postgres.database,
    password: this.config.postgres.password,
    port: this.config.postgres.port
  });

  @Lazy() get connectedClient(): Promise<Client> {
    // add db init code here 

    return this.client.connect().then(() => {
      console.log(`client connected: ${this.client}`);
      return this.client;
    });
  }
}
