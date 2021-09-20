import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { Integer } from 'neo4j-driver';
import * as path from 'path';
import { Pool } from 'pg';
import { rootCertificates } from 'tls';
import { ConfigService } from '..';
import { ILogger, Logger } from '../logger';

export type toggleSecurity =
  | 'NoSecurity'
  | 'UpdateAccessLevelSecurity'
  | 'UpdateAccessLevelAndIsClearedSecurity';
export type toggleMV = 'NoRefreshMV' | 'RefreshMV' | 'RefreshMVConcurrently';
export type toggleHistory = 'NoHistory' | 'History';
export type toggleGranters =
  | 'NoRefresh'
  | 'RefreshSecurityTables'
  | 'RefreshSecurityTablesAndMV'
  | 'RefreshSecurityTablesAndMVConcurrently';
export type toggleSensitivity = 'DontUpdateIsCleared' | 'UpdateIsCleared';
@Injectable()
export class PostgresService {
  constructor(
    private readonly config: ConfigService,
    @Logger('postgres:service') private readonly logger: ILogger
  ) {}

  pool = new Pool({
    ...this.config.postgres,
  });

  async update(
    personId: number,
    rowId: number,
    tableName: string,
    updatedValues: object,
    toggleSensitivity: toggleSensitivity,
    toggleMV: toggleMV,
    toggleHistory: toggleHistory,
    toggleGranters: toggleGranters
  ) {
    const hstoreString = this.convertObjectToHstore(updatedValues);
    const updatedRow = await this.pool.query(
      `call public.update($1::int, $2::int, $3::text,$4::hstore, $5::public.toggle_sensitivity, $6::public.toggle_mv, $7::public.toggle_history, $8::public.toggle_granters)`,
      [
        personId,
        rowId,
        tableName,
        hstoreString,
        toggleSensitivity,
        toggleMV,
        toggleHistory,
        toggleGranters,
      ]
    );
    console.log(updatedRow);
    return updatedRow;
  }
  async create(
    personId: number,
    tableName: string,
    rowToInsert: object,
    toggleSecurity: toggleSecurity,
    toggleMV: toggleMV,
    toggleHistory: toggleHistory,
    toggleGranters: toggleGranters
  ) {
    const hstoreString = this.convertObjectToHstore(rowToInsert);
    const insertedRow = await this.pool.query(
      `call public.create($1::int,$2::text,$3::hstore,$4::public.toggle_security,$5::public.toggle_mv,$6::public.toggle_history,$7::public.toggle_granters,0)`,
      [
        personId,
        tableName,
        hstoreString,
        toggleSecurity,
        toggleMV,
        toggleHistory,
        toggleGranters,
      ]
    );
    return insertedRow.rows[0].record_id;
  }

  async executeSQLFiles(dirPath: string): Promise<number> {
    const files = fs.readdirSync(dirPath);
    for (const name of files) {
      const fileOrDirPath = path.join(dirPath, name);

      if (fs.lstatSync(fileOrDirPath).isDirectory()) {
        await this.executeSQLFiles(fileOrDirPath);
      } else {
        this.logger.info('filePath:', { fileOrDirPath });
        const sql = fs.readFileSync(fileOrDirPath).toString();
        await this.pool.query(sql);
      }
    }

    return 0;
  }

  async init(toggle: number): Promise<void> {
    if (toggle === 0) {
      return;
    }
    const dbInitPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src/core/postgres/sql/db_init'
    );
    const genericFnsPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'src/core/postgres/sql/generic_fns'
    );
    await this.executeSQLFiles(dbInitPath);
    await this.executeSQLFiles(genericFnsPath);
    return;
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
  makeid = (length: number) => {
    var result = '';
    var characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  };

  async loadTestData(toggle: number) {
    //anon user - using email
    //root user
    console.log(this.pool);
    if (toggle === 0) {
      return;
    }

    // PEOPLE, ORGS, USERS
    await this.create(
      0,
      'public.people_data',
      {
        id: 0,
        about: 'root',
        public_first_name: 'root',
        neo4j_id: 'Kg8TjwvDMiS',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );

    const person1Id = await this.create(
      0,
      'public.people_data',
      {
        about: 'developer',
        public_first_name: 'general',
        neo4j_id: 'vWHetruQWVe',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );

    await this.create(
      0,
      'public.organizations_data',
      {
        id: 0,
        name: 'defaultOrg',
        neo4j_id: '5c4278da9503d5cd78e82f02',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    await this.create(
      0,
      'public.organizations_data',
      {
        name: 'org1',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );

    await this.create(
      0,
      'public.users_data',
      {
        id: 0,
        person: 0,
        email: 'devops@tsco.org',
        owning_org: 0,
        password:
          '$argon2i$v=19$m=4096,t=3,p=1$uBKKK3lQ+sEFpBAw12oZ4g$JTOABdOo/qOWR8XeSOBU89tvrmwnaEHbm9Vz8Nt0sAs',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );

    await this.create(
      0,
      'public.users_data',
      {
        person: person1Id,
        email: 'vivekvarma_dev@tsco.org',
        owning_org: 0,
        password:
          '$argon2i$v=19$m=4096,t=3,p=1$7qgYq3ROouGLxRf/xoaPKg$a6RgC3dtubY+M+ZitnfKBYDRV5GxkkxJB0nhhqDC+D4',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );

    await this.create(
      0,
      'public.global_roles_data',
      {
        id: 0,
        name: 'Administrator',
        org: 0,
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );

    await this.create(
      0,
      'public.global_roles_data',
      {
        id: 1,
        name: 'ProjectManager',
        org: 0,
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );

    // GRANTS & MEMBERSHIPS
    // const tablesWithAdminAccess = [
    //   'public.people_data',
    //   'public.locations_data',
    //   'public.organizations_data',
    //   'public.users_data',
    // ];
    // for (let i = 0; i < tablesWithAdminAccess.length; i++) {
    //   await this.pool.query('call public.add_grants_to_table($1, 'Administrator')', [
    //     tablesWithAdminAccess[i],
    //   ]);
    // }

    // PROJECTS
    // await this.create(
    //   0,
    //   'public.projects_data',
    //   { id: 0, name: 'project0' },
    //   'UpdateAccessLevelAndIsClearedSecurity',
    //   'RefreshMVConcurrently',
    //   'History',
    //   'RefreshSecurityTablesAndMVConcurrently'
    // );
    // LANGUAGES
    // await this.pool.query(
    //   `call public.create(0,'sil.table_of_languages', $1, 2,0,0,3,0)`,
    //   [
    //     this.convertObjectToHstore({
    //       id: 0,
    //       iso_639: 'txn',
    //       language_name: 'texan',
    //     }),
    //   ]
    // );

    // await this.pool.query(
    //   `call public.create(0,'sc.languages_data', $1,2,2,1,3,0)`,
    //   [
    //     this.convertObjectToHstore({
    //       id: 0,
    //       display_name: 'texan',
    //       name: 'texan',
    //       sensitivity: 'Medium',
    //     }),
    //   ]
    // );

    // LOCATIONS
    // await this.pool.query(
    //   `call public.create(0,'public.locations_data', $1,2,2,1,3,0)`,
    //   [
    //     this.convertObjectToHstore({
    //       id: 0,
    //       name: 'location0',
    //       sensitivity: 'Low',
    //       type: 'Country',
    //     }),
    //   ]
    // );

    // await this.pool.query(
    //   `insert into public.organizations_data(id,name, sensitivity) values(1,'org1', 'Low')`
    // );

    // for (let i = 2; i <= 10; i++) {
    //   const key = await this.pool.query(
    //     `call public.create(0,'public.people_data',$1 ,2,2,1,3,0); `,
    //     [
    //       this.convertObjectToHstore({
    //         about: 'developer',
    //         public_first_name: 'Vivek',
    //       }),
    //     ]
    //   );
    //   await this.pool.query(
    //     `call public.create(0, 'public.users_data', $1, 2,2,1,3,0);`,
    //     [
    //       this.convertObjectToHstore({
    //         person: key.rows[0].record_id,
    //         email: `email${i}@email.com`,
    //         password: 'password',
    //         owning_org: 0,
    //       }),
    //     ]
    //   );
    // }

    await this.create(
      0,
      'public.global_role_memberships',
      { global_role: 0, person: 0 },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    await this.create(
      0,
      'public.global_role_memberships',
      { global_role: 1, person: 0 },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    await this.create(
      0,
      'public.global_role_memberships',
      { global_role: 1, person: person1Id },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    await this.create(
      0,
      'public.language_ex_data',
      {
        lang_name: 'english',
        lang_code: 'ENG18',
        location: 'US',
        comments: 'test',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    // const personRows = await this.pool.query(
    //   `select id from public.people_data`
    // );
    // for (let { id } of personRows.rows) {
    //   console.log(id);
    //   if (id !== 0 && id !== user1pk) {
    //     await this.pool.query(
    //       `call public.create(0,'public.global_role_memberships',$1, 2,2,0,3,0)`,
    //       [
    //         this.convertObjectToHstore({
    //           global_role: 0,
    //           person: id,
    //         }),
    //       ]
    //     );
    //   }
    // }
    // for (let i = 2; i <= 10; i++) {
    //   console.log(i);
    //   await this.pool.query(
    //     `call public.create(0,'public.organizations_data', $1, 2,2,1,3,0);`,
    //     [
    //       this.convertObjectToHstore({
    //         id: i,
    //         name: `name${i}`,
    //         sensitivity: 'Low',
    //       }),
    //     ]
    //   );
    await this.create(
      0,
      'public.chats_data',
      { id: 0 },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    await this.create(
      0,
      'public.locations_data',
      {
        id: 0,
        chat_id: 0,
        neo4j_id: 'VU2BTYP66BH',
        name: `location${0}`,
        sensitivity: 'Low',
        type: 'Country',
      },
      'UpdateAccessLevelAndIsClearedSecurity',
      'RefreshMVConcurrently',
      'History',
      'RefreshSecurityTablesAndMVConcurrently'
    );
    await this.pool.query(`analyze`);

    for (let i = 1; i <= 0; i++) {
      await this.create(
        0,
        'public.chats_data',
        { id: i },
        'UpdateAccessLevelAndIsClearedSecurity',
        'RefreshMVConcurrently',
        'History',
        'RefreshSecurityTablesAndMVConcurrently'
      );
      await this.create(
        0,
        'public.locations_data',
        {
          id: i,
          chat_id: i,
          neo4j_id: 'VU2BTYP66BH',
          name: `location${i}`,
          sensitivity: 'Low',
          type: 'Country',
        },
        'UpdateAccessLevelAndIsClearedSecurity',
        'RefreshMVConcurrently',
        'History',
        'RefreshSecurityTablesAndMVConcurrently'
      );
    }
  }
}
