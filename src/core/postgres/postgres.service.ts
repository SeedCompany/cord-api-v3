import { Injectable } from '@nestjs/common';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { fstat } from 'node:fs';
import { Client, Pool } from 'pg';
import { ConfigService } from '..';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class PostgresService {
  constructor(private readonly config: ConfigService) {}
  // pools/clients will use environment variables
  // for connection information
  pool = new Pool();
  client = new Client(this.config.postgres);
  
  
  async db_init():Promise<number>{
    const connectedClient = await this.client.connect();
    console.log(__dirname);
    fs.readdirSync(path.join(__dirname,'..','..', '..', 'src/core/postgres/sql/db_init')).forEach(name=>console.log(name));
    return 0;
  }

  @Lazy() get connectedClient(): Promise<Client> {

    return this.client.connect().then(() => {
      console.log(this.client);
      return this.client;
    });
  }
}
