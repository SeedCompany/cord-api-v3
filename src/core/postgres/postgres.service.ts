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
      this.logger.info('path', { dbInitPath });
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
  // async fastInserts() {
  //   const client = await this.pool.connect();
  //   const removeTriggersPath = path.join(
  //     __dirname,
  //     '..',
  //     '..',
  //     '..',
  //     'src/core/postgres/sql/useful_scripts/fast_inserts'
  //   );
  //   await this.executeSQLFiles(client, removeTriggersPath);
  //   client.release();
  // }
  convertObjectToHstore(obj: object): string {
    let string = '';
    for (const [key, value] of Object.entries(obj)) {
      string += `"${key}"=>"${value}",`;
    }
    string = string.slice(0, string.length - 1);
    console.log(string);
    return string;
  }
  async loadTestData() {
    const client = await this.pool.connect();

    // PEOPLE, ORGS, USERS

    await client.query(
      `select public.create(0,'public.people_data',$1 ,2,1,1,2); `,
      [
        this.convertObjectToHstore({
          id: 0,
          about: 'developer',
          public_first_name: 'Vivek',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'public.organizations_data', $1, 2,1,1,2);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'defaultOrg',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'public.users_data', $1, 2,1,1,2);`,
      [
        this.convertObjectToHstore({
          id: 0,
          person: 0,
          email: 'vivek@tsco.org',
          owning_org: 0,
          password: 'password',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'public.global_roles_data', $1, 2,1,1,2);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'default_role',
          org: 0,
        }),
      ]
    );
    // GRANTS & MEMBERSHIPS
    const tables = await client.query(
      `select table_name from information_schema.tables where table_schema = 'public' and table_name like '%_data' order by table_name limit 5`
    );

    for (const { table_name } of tables.rows) {
      const columns = await client.query(
        `select column_name from information_schema.columns where table_schema='public' and table_name = $1`,
        [table_name]
      );
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const schemaTableName = `public.${table_name}`;
      this.logger.info(schemaTableName);
      for (const { column_name } of columns.rows) {
        await client.query(
          `select public.create(0, 'public.global_role_column_grants', $1,2,1,1,2)`,
          [
            this.convertObjectToHstore({
              global_role: 0,
              table_name: schemaTableName,
              column_name,
              access_level: 'Write',
            }),
          ]
        );
      }
    }

    // add role member
    const users = await client.query(`select person from public.users_data`);
    this.logger.info('adding role memberships', { userRows: users.rows });

    for (const { person } of users.rows) {
      await client.query(
        `select public.create(0, 'public.global_role_memberships', $1,2,1,1,2)`,
        [
          this.convertObjectToHstore({
            global_role: 0,
            person,
          }),
        ]
      );
      this.logger.info('global_role_memberships', { person });
    }

    // PROJECTS
    await client.query(
      `select public.create(0, 'public.projects_data', $1,2,1,1,2)`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'project0',
        }),
      ]
    );
    // LANGUAGES
    await client.query(
      `select public.create(0,'sil.table_of_languages', $1, 2,1,1,2)`,
      [
        this.convertObjectToHstore({
          id: 0,
          iso_639: 'txn',
          language_name: 'texan',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'sc.languages_data', $1,2,1,1,2)`,
      [
        this.convertObjectToHstore({
          id: 0,
          display_name: 'texan',
          name: 'texan',
          sensitivity: 'Medium',
        }),
      ]
    );

    // LOCATIONS
    await client.query(
      `select public.create(0,'public.locations_data', $1,2,1,1,2)`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'location0',
          sensitivity: 'Low',
          type: 'Country',
        }),
      ]
    );
    client.release();
    this.logger.info('all queries run');
  }
}
