import { Injectable } from '@nestjs/common';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Pool, PoolClient } from 'pg';
import { ConfigService } from '..';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PostgresService {
  constructor(private readonly config: ConfigService) {}

  pool = new Pool({
    ...this.config.postgres,
    idleTimeoutMillis: 0,
  });
  // client = new Client(this.config.postgres);

  async executeSQLFiles(client: PoolClient, dirPath: string): Promise<number> {
    fs.readdirSync(dirPath).forEach(async (name) => {
      const fileOrDirPath = path.join(dirPath, name);

      if (fs.lstatSync(fileOrDirPath).isDirectory()) {
        console.log('dir: ', fileOrDirPath);
        await this.executeSQLFiles(client, fileOrDirPath);
      } else {
        // load script into db
        console.log('file: ', fileOrDirPath);
        const sql = fs.readFileSync(fileOrDirPath).toString();
        await client.query(sql);
      }
    });
    return 0;
  }

  async db_init(): Promise<number> {
    const client = await this.pool.connect();
    try {
      // await this.client.connect();
      const dbInitPath = path.join(
        __dirname,
        '..',
        '..',
        '..',
        'src/core/postgres/sql/db_init'
      );
      const fileExecutionStatus = await this.executeSQLFiles(
        client,
        dbInitPath
      );
      console.log('here', fileExecutionStatus);
    } finally {
      // console.log(this.pool.totalCount, this.pool.idleCount);
      client.release();
      // console.log(this.pool.totalCount, this.pool.idleCount);
      // await this.pool.end();
    }
    return 0;
  }

  // @Lazy() get connectedClient(): Promise<Client> {
  //   return this.client.connect().then(() => {
  //     console.log(this.client);
  //     return this.client;
  //   });
  // }
}
