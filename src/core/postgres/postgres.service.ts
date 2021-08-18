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

  private pgInitStatus = false;
  pool = new Pool({
    ...this.config.postgres,
  });

  async usePool() {
    if (!this.pgInitStatus) {
      this.init();
      this.loadTestData();
      this.pgInitStatus = true;
    }
    return this.pool;
  }

  async executeSQLFiles(dirPath: string): Promise<number> {
    const files = fs.readdirSync(dirPath);

    for (const name of files) {
      const fileOrDirPath = path.join(dirPath, name);

      if (fs.lstatSync(fileOrDirPath).isDirectory()) {
        this.logger.info('dir: ', { fileOrDirPath });
        await this.executeSQLFiles(fileOrDirPath);
      } else {
        // load script into db
        this.logger.info('file: ', { fileOrDirPath });
        const sql = fs.readFileSync(fileOrDirPath).toString();
        await this.pool.query(sql);
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
      const fileExecutionStatus = await this.executeSQLFiles(dbInitPath);
      this.logger.info('here', { fileExecutionStatus });
    } finally {
      client.release();
    }
    return 0;
  }
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
    const genericFnsPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src/core/postgres/sql/generic_fns_approach'
    );
    await this.executeSQLFiles(genericFnsPath);
    // PEOPLE, ORGS, USERS

    await this.pool.query(
      `call public.create(0,'public.people_data',$1 ,2,2,1,3); `,
      [
        this.convertObjectToHstore({
          id: 0,
          about: 'developer',
          public_first_name: 'Vivek',
        }),
      ]
    );

    await this.pool.query(
      `call public.create(0,'public.organizations_data', $1, 2,2,1,3);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'defaultOrg',
        }),
      ]
    );

    await this.pool.query(
      `call public.create(0,'public.users_data', $1, 2,2,1,3);`,
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

    await this.pool.query(
      `call public.create(0,'public.global_roles_data', $1, 2,2,1,3);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'default_role',
          org: 0,
        }),
      ]
    );
    // GRANTS & MEMBERSHIPS
    const tables = ['locations_data', 'people_data', 'organizations_data'];
    for (const table_name of tables) {
      const columns = await this.pool.query(
        `select column_name from information_schema.columns where table_schema='public' and table_name in ($1)`,
        [table_name]
      );

      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const schemaTableName = `public.${table_name}`;
      this.logger.info(schemaTableName);
      for (const { column_name } of columns.rows) {
        await this.pool.query(
          `call public.create(0, 'public.global_role_column_grants', $1,2,0,0,3)`,
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

    // PROJECTS
    await this.pool.query(
      `call public.create(0, 'public.projects_data', $1,2,2,1,3)`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'project0',
        }),
      ]
    );
    // LANGUAGES
    await this.pool.query(
      `call public.create(0,'sil.table_of_languages', $1, 2,0,0,3)`,
      [
        this.convertObjectToHstore({
          id: 0,
          iso_639: 'txn',
          language_name: 'texan',
        }),
      ]
    );

    await this.pool.query(
      `call public.create(0,'sc.languages_data', $1,2,2,1,3)`,
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
    await this.pool.query(
      `call public.create(0,'public.locations_data', $1,2,2,1,3)`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'location0',
          sensitivity: 'Low',
          type: 'Country',
        }),
      ]
    );

    this.logger.info('people inserted');
    await this.pool.query(
      `insert into public.organizations_data(id,name, sensitivity) values(1,'org1', 'Low')`
    );

    for (let i = 1; i <= 10; i++) {
      await this.pool.query(
        `call public.create(0,'public.people_data',$1 ,2,2,1,3); `,
        [
          this.convertObjectToHstore({
            id: i,
            about: 'developer',
            public_first_name: 'Vivek',
          }),
        ]
      );
    }
    const data = await this.pool.query(
      `select * from public.people_materialized_view where __person_id = 10 and __id = 10`
    );
    console.log(data);
    for (let i = 0; i < 10; i++) {
      await this.pool.query(
        `call public.create(0,'public.global_role_memberships',$1, 0,0,0,0)`,
        [
          this.convertObjectToHstore({
            global_role: 0,
            person: i,
          }),
        ]
      );
      this.logger.info('generic create run');
    }
    // await this.pool.query(
    await this.pool.query(
      `call public.create(0,'public.global_role_memberships',$1, 2,2,0,3)`,
      [
        this.convertObjectToHstore({
          global_role: 0,
          person: 10,
        }),
      ]
    );
    console.time('genericOrgs');
    for (let i = 2; i <= 10; i++) {
      console.log(i);
      await this.pool.query(
        `call public.create(0,'public.organizations_data', $1, 2,0,1,3);`,
        [
          this.convertObjectToHstore({
            id: i,
            name: `name${i}`,
            sensitivity: 'Low',
          }),
        ]
      );
      await this.pool.query(
        `refresh materialized view concurrently public.organizations_materialized_view`
      );
    }
    // await this.pool.query('analyze');
    for (let i = 1; i <= 10; i++) {
      console.log(i);
      // refreshing mv outside the create fn is much faster for some reason
      await this.pool.query(
        `call public.create(0,'public.locations_data', $1,2,2,1,3)`,
        [
          this.convertObjectToHstore({
            id: i,
            name: `location${i}`,
            sensitivity: 'Low',
            type: 'Country',
          }),
        ]
      );
      // await this.pool.query(
      //   `refresh materialized view concurrently public.locations_materialized_view`
      // );
    }
  }
}
