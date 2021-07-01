import { Injectable } from '@nestjs/common';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Client, Pool } from 'pg';

@Injectable()
export class PostgresService {
  // pools/clients will use environment variables
  // for connection information
  pool = new Pool();
  client = new Client();

  @Lazy() get connectedClient(): Promise<Client> {
    return this.client.connect().then(() => {
      console.log(this.client)
      return this.client;
    });
  }
}
 