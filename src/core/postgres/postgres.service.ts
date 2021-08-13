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
  convertObjectToHstore(obj: object): string {
    let string = '';
    for (const [key, value] of Object.entries(obj)) {
      string += `"${key}"=>"${value}",`;
    }
    string = string.slice(0, string.length - 1);
    console.log(string);
    return string;
  }

  async loadTestDataUsingGenericCreate() {
    const genericFnsPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src/core/postgres/sql/generic_fns_approach'
    );
    const client = await this.pool.connect();
    await this.executeSQLFiles(client, genericFnsPath);
    // PEOPLE, ORGS, USERS

    await client.query(
      `select public.create(0,'public.people_data',$1 ,2,2,1,3); `,
      [
        this.convertObjectToHstore({
          id: 0,
          about: 'developer',
          public_first_name: 'Vivek',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'public.organizations_data', $1, 2,2,1,3);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'defaultOrg',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'public.users_data', $1, 2,2,1,3);`,
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
      `select public.create(0,'public.global_roles_data', $1, 2,2,1,3);`,
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
          `select public.create(0, 'public.global_role_column_grants', $1,2,2,1,3)`,
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
        `select public.create(0, 'public.global_role_memberships', $1,2,2,1,3)`,
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
      `select public.create(0, 'public.projects_data', $1,2,2,1,3)`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'project0',
        }),
      ]
    );
    // LANGUAGES
    await client.query(
      `select public.create(0,'sil.table_of_languages', $1, 2,2,1,3)`,
      [
        this.convertObjectToHstore({
          id: 0,
          iso_639: 'txn',
          language_name: 'texan',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'sc.languages_data', $1,2,2,1,3)`,
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
      `select public.create(0,'public.locations_data', $1,2,2,1,3)`,
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
    console.timeEnd('generic');
    this.logger.info('all queries run');
  }

  async loadTestDataUsingTriggers() {
    const triggersPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src/core/postgres/sql/trigger_approach'
    );
    const client = await this.pool.connect();
    await this.executeSQLFiles(client, triggersPath);
    await client.query(
      `insert into public.people_data(id,about,public_first_name) values($1,$2,$3)`,
      [0, 'Vivek', 'developer']
    );
    await client.query(
      `insert into public.organizations_data(id,name) values($1,$2)`,
      [0, 'defaultOrg']
    );
    await client.query(
      `insert into public.users_data(id,person, email, owning_org, password) values($1,$2,$3,$4,$5)`,
      [0, 0, 'vivek@tsco.org', 0, 'password']
    );
    await client.query(
      `insert into public.global_roles_data(id,name,org) values($1,$2,$3)`,
      [0, 'defaultRole', 0]
    );
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
          `insert into public.global_role_column_grants(global_role, table_name,column_name, access_level) values($1,$2,$3,$4)`,
          [0, schemaTableName, column_name, 'Write']
        );
      }
    }
    const users = await client.query(`select person from public.users_data`);
    this.logger.info('adding role memberships', { userRows: users.rows });

    for (const { person } of users.rows) {
      await client.query(
        `insert into public.global_role_memberships(global_role, person) values($1,$2)`,
        [0, person]
      );
      this.logger.info('global_role_memberships', { person });
    }

    await client.query(
      `insert into public.projects_data(id,name) values($1,$2)`,
      [0, 'project0']
    );

    await client.query(
      `insert into sil.table_of_languages(id, iso_639, language_name) values(0, 'txn', 'texan')`
    );

    await client.query(
      `insert into sc.languages_data(id,display_name, name,sensitivity) values($1,$2,$3,$4)`,
      [0, 'texan', 'texan', 'Medium']
    );

    await client.query(
      `insert into public.locations_data(id,name,sensitivity,type) values($1,$2,$3,$4)`,
      [0, 'location0', 'Low', 'Country']
    );
    // await client.query(
    //   `insert into public.people_data(id,about, public_first_name) values(generate_series(1,100), 'about' || generate_series(1,100), 'name' || generate_series(1,100))`
    // );
    // for (let i = 1; i <= 100; i++) {
    //   await client.query(
    //     `insert into public.people_data(id, public_first_name) values($1,$2)`,
    //     [i, 'Vivek']
    //   );
    // }
    console.timeEnd('triggers');
    this.logger.info('people inserted');
    await client.query(
      `insert into public.organizations_data(id,name, sensitivity) values(1,'org1', 'Low')`
    );
    const genericFnsPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src/core/postgres/sql/generic_fns_approach'
    );
    await this.executeSQLFiles(client, genericFnsPath);
    for (let i = 1; i <= 100; i++) {
      await client.query(
        `select public.create(0,'public.people_data',$1 ,2,2,1,3); `,
        [
          this.convertObjectToHstore({
            id: i,
            about: 'developer',
            public_first_name: 'Vivek',
          }),
        ]
      );
    }
    for (let i = 1; i <= 99; i++) {
      await client.query(
        `select public.create(0,'public.global_role_memberships',$1, 0,0,0,0)`,
        [
          this.convertObjectToHstore({
            global_role: 0,
            person: i,
          }),
        ]
      );
      this.logger.info('generic create run');
    }
    // await client.query(
    await client.query(
      `select public.create(0,'public.global_role_memberships',$1, 2,2,1,3)`,
      [
        this.convertObjectToHstore({
          global_role: 0,
          person: 100,
        }),
      ]
    );
    console.time('genericOrgs');
    for (let i = 2; i <= 100; i++) {
      console.log(i);
      await client.query(
        `select public.create(0,'public.organizations_data', $1, 2,2,1,3);`,
        [
          this.convertObjectToHstore({
            id: i,
            name: `name${i}`,
            sensitivity: 'Low',
          }),
        ]
      );
    }
    // await client.query('analyze');
    for (let i = 2; i <= 100; i++) {
      console.log(i);
      // await client.query(
      //   `select public.create(0,'public.organizations_data', $1, 2,2,1,3);`,
      //   [
      //     this.convertObjectToHstore({
      //       id: i,
      //       name: `name${i}`,
      //       sensitivity: 'Low',
      //     }),
      //   ]
      // );
      await client.query(
        `select public.create(0,'public.locations_data', $1,2,0,1,3)`,
        [
          this.convertObjectToHstore({
            id: i,
            name: `location${i}`,
            sensitivity: 'Low',
            type: 'Country',
          }),
        ]
      );
      await client.query(
        `refresh materialized view concurrently public.locations_materialized_view`
      );
    }
    // insertRecord(personid, recordobject, tablename)
    // -> createMethod
    // -> refresh the mv 
    console.timeEnd('genericOrgs');
    await this.executeSQLFiles(client, triggersPath);
    // await client.query(
    //   `insert into public.users_data(id,person, email, owning_org, password) values(generate_series(1,100), generate_series(1,100), 'user' || generate_series(1,100) || '@tsco.org', 0, 'password')`
    // );

    // console.time('triggerOrgs');
    // for (let i = 2; i <= 100; i++) {
    //   console.log(i);
    //   await client.query(
    //     `insert into public.organizations_data(id,name) values($1, $2)`,
    //     [i, `org${i}`]
    //   );
    // }
    // console.timeEnd('triggerOrgs');
    client.release();
  }
}
