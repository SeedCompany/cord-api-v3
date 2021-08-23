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

  static pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'password',
    database: 'postgres',
    port: 5432,
  });

  static async executeSQLFiles(dirPath: string): Promise<number> {
    const files = fs.readdirSync(dirPath);

    for (const name of files) {
      const fileOrDirPath = path.join(dirPath, name);

      if (fs.lstatSync(fileOrDirPath).isDirectory()) {
        await this.executeSQLFiles(fileOrDirPath);
      } else {
        const sql = fs.readFileSync(fileOrDirPath).toString();
        await this.pool.query(sql);
      }
    }

    return 0;
  }

  static async init(): Promise<number> {
    const dbInitPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src/core/postgres/sql/db_init'
    );
    await this.executeSQLFiles(dbInitPath);

    return 0;
  }
  static convertObjectToHstore(obj: object): string {
    let string = '';
    for (const [key, value] of Object.entries(obj)) {
      string += `"${key}"=>"${value}",`;
    }
    string = string.slice(0, string.length - 1);
    console.log(string);
    return string;
  }

  static async loadTestData() {
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
      `call public.create(0,'public.people_data',$1 ,2,2,1,3,0); `,
      [
        this.convertObjectToHstore({
          id: 0,
          about: 'developer',
          public_first_name: 'Vivek',
        }),
      ]
    );

    await this.pool.query(
      `call public.create(0,'public.organizations_data', $1, 2,2,1,3,0);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'defaultOrg',
        }),
      ]
    );

    await this.pool.query(
      `call public.create(0,'public.users_data', $1, 2,2,1,3,0);`,
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
      `call public.create(0,'public.global_roles_data', $1, 2,2,1,3,0);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'default_role',
          org: 0,
        }),
      ]
    );
    // GRANTS & MEMBERSHIPS
    const tables = [
      'locations_data',
      'people_data',
      'organizations_data',
      'users_data',
    ];

    const columns = await this.pool.query(
      `select column_name,table_name from information_schema.columns where table_schema='public' and table_name = any($1::text[])`,
      [tables]
    );

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    // this.logger.info(schemaTableName);
    for (const { column_name, table_name } of columns.rows) {
      const schemaTableName = `public.${table_name}`;
      await this.pool.query(
        `call public.create(0, 'public.global_role_column_grants', $1,2,0,0,3,0)`,
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

    // PROJECTS
    await this.pool.query(
      `call public.create(0, 'public.projects_data', $1,2,2,1,3,0)`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'project0',
        }),
      ]
    );
    // LANGUAGES
    await this.pool.query(
      `call public.create(0,'sil.table_of_languages', $1, 2,0,0,3,0)`,
      [
        this.convertObjectToHstore({
          id: 0,
          iso_639: 'txn',
          language_name: 'texan',
        }),
      ]
    );

    await this.pool.query(
      `call public.create(0,'sc.languages_data', $1,2,2,1,3,0)`,
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
      `call public.create(0,'public.locations_data', $1,2,2,1,3,0)`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'location0',
          sensitivity: 'Low',
          type: 'Country',
        }),
      ]
    );

    await this.pool.query(
      `insert into public.organizations_data(id,name, sensitivity) values(1,'org1', 'Low')`
    );

    for (let i = 1; i <= 10; i++) {
      const key = await this.pool.query(
        `call public.create(0,'public.people_data',$1 ,2,2,1,3,0); `,
        [
          this.convertObjectToHstore({
            about: 'developer',
            public_first_name: 'Vivek',
          }),
        ]
      );
      await this.pool.query(
        `call public.create(0, 'public.users_data', $1, 2,2,1,3,0);`,
        [
          this.convertObjectToHstore({
            person: key.rows[0].record_id,
            email: `email${i}@email.com`,
            password: 'password',
            owning_org: 0,
          }),
        ]
      );
    }

    for (let i = 0; i < 10; i++) {
      await this.pool.query(
        `call public.create(0,'public.global_role_memberships',$1, 0,0,0,0,0)`,
        [
          this.convertObjectToHstore({
            global_role: 0,
            person: i,
          }),
        ]
      );
    }
    await this.pool.query(
      `call public.create(0,'public.global_role_memberships',$1, 2,2,0,3,0)`,
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
        `call public.create(0,'public.organizations_data', $1, 2,0,1,3,0);`,
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
    for (let i = 1; i <= 10; i++) {
      console.log(i);
      await this.pool.query(
        `call public.create(0,'public.locations_data', $1,2,2,1,3,0)`,
        [
          this.convertObjectToHstore({
            id: i,
            name: `location${i}`,
            sensitivity: 'Low',
            type: 'Country',
          }),
        ]
      );

    }
    await this.pool.query(`analyze`);
  }
  // async usePool() {
  //   if (!this.pgInitStatus) {
  //     this.init();
  //     this.loadTestData();
  //     this.pgInitStatus = true;
  //   }
  //   return this.pool;
  // }
}
