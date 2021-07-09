import { Injectable } from '@nestjs/common';
import { LazyGetter as Lazy } from 'lazy-get-decorator';
import { Client, Pool, PoolClient } from 'pg';
import { ConfigService } from '..';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PostgresService {
  constructor(private readonly config: ConfigService) {}

  pool = new Pool({ ...this.config.postgres, max: 20 });
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
        try {
          const res = await client.query(sql);
        } catch (e) {
          console.log('error:', e.message);
        }
      }
    });
    return 0;
  }

  async db_init(): Promise<number> {
    let client;
    try {
      // await this.client.connect();
      client = await this.pool.connect();
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
      return 0;
    } catch (e) {
      console.log('db_init error: ', e.message);
      return 1;
    } finally {
      client?.release();
      // await this.pool.end();
    }
  }

  // @Lazy() get connectedClient(): Promise<Client> {
  //   return this.client.connect().then(() => {
  //     console.log(this.client);
  //     return this.client;
  //   });
  // }
}
