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
    const pool = this.pool;
    const client = await pool.connect();

    // PEOPLE, ORGS, USERS

    await client.query(
      `select public.create(0,'public.people_data',$1 ,2,1,1,1); `,
      [
        this.convertObjectToHstore({
          id: 0,
          about: 'developer',
          public_first_name: 'Vivek',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'public.organizations_data', $1, 2,1,1,1);`,
      [
        this.convertObjectToHstore({
          id: 0,
          name: 'defaultOrg',
        }),
      ]
    );

    await client.query(
      `select public.create(0,'public.users_data', $1, 2,1,1,1);`,
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
      `select public.create(0,'public.global_roles_data', $1, 2,1,1,1);`,
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
          `select public.create(0, 'public.global_role_column_grants_data', $1,2,1,1,1)`,
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
        `select public.create(0, 'public.global_memberships_data', $1,2,1,1,1)`,
        [
          this.convertObjectToHstore({
            global_role: 0,
            person,
          }),
        ]
      );
      this.logger.info('global_role_memberships_data', { person });
    }
    // this.logger.info('project queries');
    // //projects
    // for (let i = 1; i < 2; i++) {
    //   const projectRole = `projRole${i}`;
    //   const projName = `proj${i}`;
    //   await client.query(
    //     `insert into public.projects_data("name") values ($1) on conflict do nothing;`,
    //     [projName]
    //   );
    //   this.logger.info('projects_data', {
    //     projectName: projName,
    //   });
    //   await client.query(
    //     `insert into public.project_roles_data("name", "org") values ($1, 0) on conflict do nothing`,
    //     [projectRole]
    //   );
    //   this.logger.info('project_roles_data', {
    //     projectRole,
    //   });
    //   await client.query(
    //     `insert into public.project_memberships_data("person", "project") values (0,$1) on conflict do nothing;`,
    //     [i]
    //   );
    //   this.logger.info('project_memberships_data', {
    //     person: 0,
    //     project: i,
    //   });
    //   await client.query(
    //     `insert into public.project_member_roles_data("person", "project", "project_role") values (1, $1, 1) on conflict do nothing;`,
    //     [i]
    //   );
    //   this.logger.info('project_member_roles_data', {
    //     person: 1,
    //     project: i,
    //     projectRole: i,
    //   });
    // }
    // await client.query(`insert into public.project_role_column_grants_data("access_level","column_name", "project_role", "table_name")
    //   values('Write', 'name', 1, 'public.locations_data' );`);
    // this.logger.info('project_role_column_grants_data');
    client.release();
    // this.logger.info('all queries run');
    // // await pool.end();
    // // this.logger.info('pool ended');
  }
}
