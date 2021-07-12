import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Pool, PoolClient } from 'pg';
import { ConfigService } from '..';
import { ILogger, Logger } from '../logger';

@Injectable()
export class PostgresService {
  constructor(
    private readonly config: ConfigService,
    @Logger('postgres:service') private readonly logger: ILogger
  ) {}

  pool = new Pool({
    ...this.config.postgres,
    idleTimeoutMillis: 0,
  });

  async executeSQLFiles(client: PoolClient, dirPath: string): Promise<number> {
    const files = fs.readdirSync(dirPath);

    for (const name of files) {
      const fileOrDirPath = path.join(dirPath, name);

      if (fs.lstatSync(fileOrDirPath).isDirectory()) {
        this.logger.info('dir: ', { fileOrDirPath });
        await this.executeSQLFiles(client, fileOrDirPath);
      } else {
        // load script into db
        this.logger.info('file: ', { fileOrDirPath });
        const sql = fs.readFileSync(fileOrDirPath).toString();
        await client.query(sql);
      }
    }

    return 0;
  }

  async init(): Promise<number> {
    const client = await this.pool.connect();
    try {
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
      this.logger.info('here', { fileExecutionStatus });
    } finally {
      client.release();
    }
    return 0;
  }
}
