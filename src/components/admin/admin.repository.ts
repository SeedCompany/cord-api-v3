import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  SyntaxError,
} from '../../core';
import { PostgresService } from '../../core/postgres/postgres.service';

@Injectable()
export class AdminRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly pg: PostgresService,
    private readonly config: ConfigService,
    @Logger('admin:repository') private readonly logger: ILogger
  ) {}

  async pgInit() {
    await this.pg.init();
  }

  async loadTestData() {
    // 1.6s without refreshing mv concurrently
    console.time();
    await this.pg.loadTestDataUsingGenericCreate();
    console.timeEnd();
  }

  async loadData() {
    const pool = this.pg.pool;
    this.logger.info('pool info', {
      idleCount: pool.idleCount,
      totalCount: pool.totalCount,
    });
    const client = await pool.connect();
    this.logger.info('pool info', {
      idleCount: pool.idleCount,
      totalCount: pool.totalCount,
    });
    await client.query(
      `select public.create(0,'public.people_data',$1 ,2,1,1,1); `,
      ['"id" => "2","public_first_name"=>"rhuan"']
    );
    // // copying over tab data
    // const tabDataPath = path.join(
    //   __dirname,
    //   '..',
    //   '..',
    //   '..',
    //   'src/core/postgres/sql/tab_data'
    // );
    // console.log(tabDataPath);
    // const countryCodesPath = `${tabDataPath}/CountryCodes.tab`;
    // await client.query(
    //   `copy sil.country_codes
    //   from /home/questionreality/cord-api-v3/src/core/postgres/sql/tab_data/CountryCodes.tab delimiter '	';`
    // );

    // default inserts
    // await client.query(
    //   `insert into public.people_data("id", "public_first_name") values($1, $2)`,
    //   [0, 'defaultPerson']
    // );
    // await client.query(
    //   `insert into public.organizations_data("id", "name") values($1, $2)`,
    //   [0, 'defaultOrg']
    // );
    // await client.query(
    //   `insert into public.users_data("id", "person", "email","owning_org", "password") values(0,0,'defaultEmail', 0, 'abc')`
    // );
    // await client.query(
    //   `insert into public.global_roles_data("id","name", "org") values(0,'defaultRole',0)`
    // );

    // // inserting a lot of data
    // for (let i = 1; i < 2; i++) {
    //   const orgName = `org${i}`;
    //   // const personName = `person${i}`;
    //   const locationName = `location${i}`;
    //   const userData = {
    //     email: `email${i}`,
    //     password: 'abc',
    //     org: 'defaultOrg',
    //   };
    //   const roleData = { name: `role${i}`, org: 'defaultOrg' };
    //   await client.query(
    //     `insert into public.organizations_data("id", "name") values($1, $2)`,
    //     [i, orgName]
    //   );
    //   await client.query(
    //     `insert into public.locations_data("name", "sensitivity", "type") values($1, 'Low', 'Country')`,
    //     [locationName]
    //   );
    //   await client.query(`select * from public.sys_register($1,$2,$3)`, [
    //     userData.email,
    //     userData.password,
    //     userData.org,
    //   ]);
    //   await client.query(`select * from public.sys_create_role($1, $2)`, [
    //     roleData.name,
    //     roleData.org,
    //   ]);
    // }

    // // adding grants and memberships
    // // 1. get the table name and column names
    // // 2. add grants to half of them (odd/even)
    // // 3. grant memberships to half the members (odd/even)
    // //PUBLIC
    // const tables = await client.query(
    //   `select table_name from information_schema.tables where table_schema = 'public' and table_name like '%_data' order by table_name`
    // );

    // this.logger.info('rows', { rows: tables.rows });

    // for (const tableRow of tables.rows) {
    //   const columns = await client.query(
    //     `select column_name from information_schema.columns where table_schema='public' and table_name = $1`,
    //     [tableRow.table_name]
    //   );
    //   // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    //   const schemaTableName = `public.${tableRow.table_name}`;
    //   this.logger.info(schemaTableName);
    //   let index = 0;
    //   for (const columnRow of columns.rows) {
    //     const accessLevel = index % 2 === 0 ? 'Read' : 'Write';
    //     index++;
    //     this.logger.info('column info', {
    //       schemaTableName,
    //       columnName: columnRow.column_name,
    //       accessLevel,
    //     });
    //     await client.query(
    //       `select * from public.sys_add_role_grant($1, $2, $3, $4, $5 )`,
    //       [
    //         'defaultRole',
    //         'defaultOrg',
    //         schemaTableName,
    //         columnRow.column_name,
    //         accessLevel,
    //       ]
    //     );
    //   }
    // }
    // const scTables = await client.query(
    //   `select table_name from information_schema.tables where table_schema = 'sc' and table_name like '%_data' order by table_name`
    // );

    // this.logger.info('rows', { rows: scTables.rows });

    // for (const tableRow of scTables.rows) {
    //   const columns = await client.query(
    //     `select column_name from information_schema.columns where table_schema='sc' and table_name = $1`,
    //     [tableRow.table_name]
    //   );
    //   // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    //   const schemaTableName = `sc.${tableRow.table_name}`;
    //   this.logger.info(schemaTableName);
    //   let index = 0;
    //   for (const columnRow of columns.rows) {
    //     const accessLevel = index % 2 === 0 ? 'Read' : 'Write';
    //     index++;
    //     this.logger.info('column info', {
    //       schemaTableName,
    //       columnName: columnRow.column_name,
    //       accessLevel,
    //     });
    //     await client.query(
    //       `select * from public.sys_add_role_grant($1, $2, $3, $4, $5 )`,
    //       [
    //         'defaultRole',
    //         'defaultOrg',
    //         schemaTableName,
    //         columnRow.column_name,
    //         accessLevel,
    //       ]
    //     );
    //   }
    // }

    // // add role member
    // const users = await client.query(`select person from public.users_data`);
    // this.logger.info('adding role memberships', { userRows: users.rows });

    // for (const row of users.rows) {
    //   await client.query(
    //     `insert into public.global_role_memberships("person", "global_role") values($1, 0)`,
    //     [row.person]
    //   );
    //   this.logger.info('global_role_memberships', { person: row.person });
    // }
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
    return true;
  }
  async fastInserts() {
    // await this.pg.fastInserts();
    const client = await this.pg.pool.connect();
    await client.query(
      `insert into public.people_data("id", "public_first_name") values($1, $2)`,
      [0, 'defaultPerson']
    );
    this.logger.info('person inserted');
    await client.query(
      `insert into public.locations_data("id","name", "sensitivity", "type") values(0, 'defaultLocation', 'Low', 'Country')`
    );
    await client.query(
      `insert into public.organizations_data("id", "name") values($1, $2)`,
      [0, 'defaultOrg']
    );
    await client.query(
      `insert into public.users_data("id", "person", "email","owning_org", "password") values(0,0,'default@tsco.org', 0, 'abc')`
    );
    await client.query(
      `insert into public.global_roles_data("id","name", "org") values(0,'defaultRole',0)`
    );
    await client.query(
      `insert into public.projects_data("id","name",primary_location) values ($1,$2, $3) on conflict do nothing;`,
      [0, 'proj0', 0]
    );
    this.logger.info('sc inserts started');
    //SC
    await client.query(`insert into sc.organizations_data(id,base64, internal) values(0,'defaultOrg', 'internal_defaultOrg');
    `);
    await client.query(
      `insert into sc.change_to_plans_data(id, created_by, status, summary,type) values(0,0, 'a', 'what can i change?', 'a' );`
    );
    await client.query(
      `insert into sc.directories_data(id, name, parent) values(0,'dir0', 0);`
    );
    await client.query(
      `insert into sc.posts_directory(id) values(0);
      `
    );
    await client.query(`insert into sc.projects_data(id,project,base64,active,department, root_directory, posts_directory) 
    values(0,0,'proj0', true,  'dept0', 0,0);`);
    await client.query(
      `insert into sc.files_data(id,directory,name) values(0,0,'defaultFile')`
    );
    await client.query(
      `insert into sc.file_versions_data(id,category,name,mime_type, file,file_url) values(0,'budgets','file_ver0', 'A', 0, 'home/file0');`
    );
    await client.query(
      `insert into sc.budgets_data(base64,project, universal_template) values('lalala', 0 ,0);`
    );
    await client.query(
      `insert into sc.partners_data(id, active,point_of_contact,organization, pmc_entity_code)values(0,true,0,'defaultOrg', 'default_code');
      `
    );
    await client.query(
      `insert into sc.partnerships_data(id,base64,project,partner,agreement) values(0,'defaultPartnership',0,'defaultOrg',0);
      `
    );
    await client.query(
      `insert into sc.budget_records_data(base64,budget,active,fiscal_year,partnership,amount ) values('defaultBudgetRecord',1,true, 2021,'defaultPartnership', 2500);`
    );

    await client.query(`insert into sc.posts_data(id,directory,type,shareability,body) values(0,0,'Note','Internal', 'Note0');
    `);

    await client.query(`insert into sc.periodic_reports_directory(id) values(0);
    `);

    await client.query(`insert into sc.periodic_reports_data(id, directory, start_at,end_at,type,reportFile) values 
    (0,0,'2020-01-01', '2020-12-12','Narrative',0);`);

    await client.query(`insert into project_memberships_data(project,person) values (0,0);
    `);

    await client.query(
      `insert into sil.table_of_languages(id, iso_639, language_name) values (0, 'txn', 'texan');`
    );

    await client.query(
      `insert into sc.languages_data(id,display_name,name,sensitivity) values(0, 'texan', 'texan','Medium');`
    );

    await client.query(`insert into public.scripture_references(id, book_start, book_end, chapter_start, chapter_end, verse_start, verse_end) values(0, 'Genesis', 'Genesis', 1, 10, 1, 10);
    `);

    await client.query(`insert into sc.language_locations_data(ethnologue,location) values(0,0);
    `);

    await client.query(`insert into sc.language_engagements_data(id,base64,change_to_plan,ethnologue,periodic_reports_directory, pnp_file,project) values(0, 'lang123',0,0,0,0,0);
    `);
    // inserting a lot of data
    for (let i = 1; i < 10; i++) {
      const orgName = `org${i}`;
      const fileName = `file${i}`;
      const internalOrgName = `internalOrg${i}`;
      // const personName = `person${i}`;
      const locationName = `location${i}`;
      const deptName = `dept${i}`;
      const userData = {
        email: `email${i}@tsco.org`,
        password: 'abc',
        org: 'defaultOrg',
      };
      const roleData = { name: `role${i}`, org: 'defaultOrg' };

      await client.query(
        `insert into public.organizations_data("id", "name") values($1, $2)`,
        [i, orgName]
      );
      await client.query(
        `insert into sc.organizations_data("id", "base64", "internal") values($1, $2, $3)`,
        [i, orgName, internalOrgName]
      );
      this.logger.info('orgs', { i });
      await client.query(
        `insert into public.locations_data("name", "sensitivity", "type") values($1, 'Low', 'Country')`,
        [locationName]
      );
      await client.query(`select * from public.sys_register($1,$2,$3)`, [
        userData.email,
        userData.password,
        userData.org,
      ]);
      this.logger.info('users', { i });
      await client.query(`select * from public.sys_create_role($1, $2)`, [
        roleData.name,
        roleData.org,
      ]);
      const projName = `proj${i}`;
      await client.query(
        `insert into public.projects_data("name", primary_location) values ($1, 0) on conflict do nothing;`,
        [projName]
      );
      await client.query(
        `insert into sc.projects_data(project,base64,active,department, root_directory, posts_directory) 
      values($1,$2, true, $3, 0, 0);`,
        [i, orgName, deptName]
      );
      this.logger.info('projects', { i });
      await client.query(
        `insert into sc.files_data(id,directory,name) values ($1,0, $2);`,
        [i, fileName]
      );
      this.logger.info('files', { i });
    }
    client.release();
  }

  finishing(callback: () => Promise<void>) {
    return this.db.runOnceUntilCompleteAfterConnecting(callback);
  }

  async apocVersion() {
    try {
      const res = await this.db
        .query()
        .return('apoc.version() as version')
        .asResult<{ version: string }>()
        .first();
      return res?.version;
    } catch (e) {
      if (e instanceof SyntaxError) {
        return undefined;
      }
      throw e;
    }
  }

  async mergeRootSecurityGroup(powers: string[], id: string) {
    await this.db
      .query()
      .merge([
        node('sg', 'RootSecurityGroup', {
          id,
        }),
      ])
      .onCreate.setLabels({ sg: ['RootSecurityGroup', 'SecurityGroup'] })
      .setValues({
        sg: {
          id,
          powers,
        },
      })
      .run();
  }

  async mergePublicSecurityGroup(id: string) {
    await this.db
      .query()
      .merge([
        node('sg', 'PublicSecurityGroup', {
          id,
        }),
      ])
      .onCreate.setLabels({ sg: ['PublicSecurityGroup', 'SecurityGroup'] })
      .setValues({
        'sg.id': id,
      })
      .run();
  }

  async mergeAnonUser(
    createdAt: DateTime,
    anonUserId: string,
    publicSecurityGroupId: string
  ) {
    await this.db
      .query()
      .merge([
        node('anon', 'AnonUser', {
          id: anonUserId,
        }),
      ])
      .onCreate.setLabels({ anon: ['AnonUser', 'User', 'BaseNode'] })
      .setValues({
        'anon.createdAt': createdAt,
        'anon.id': anonUserId,
      })
      .with('*')
      .match([
        node('publicSg', 'PublicSecurityGroup', {
          id: publicSecurityGroupId,
        }),
      ])
      .merge([node('publicSg'), relation('out', '', 'member'), node('anon')])
      .run();
  }

  async checkExistingRoot() {
    return await this.db
      .query()
      .match([
        node('email', 'EmailAddress'),
        relation('in', '', 'email', { active: true }),
        node('root', ['RootUser']),
        relation('out', '', 'password', { active: true }),
        node('pw', 'Property'),
      ])
      .return(['root.id as id', 'email.value as email', 'pw.value as hash'])
      .asResult<{ id: ID; email: string; hash: string }>()
      .first();
  }

  async mergeRootAdminUser(email: string, hashedPassword: string) {
    await this.db
      .query()
      .match([
        node('email', 'EmailAddress'),
        relation('in', '', 'email', { active: true }),
        node('root', ['RootUser']),
        relation('out', '', 'password', { active: true }),
        node('pw', 'Property'),
      ])
      .setValues({
        email: { value: email },
        pw: { value: hashedPassword },
      })
      .run();
  }

  async setUserLabel(powers: string[], id: string) {
    await this.db
      .query()
      .matchNode('user', 'User', { id })
      .setLabels({ user: 'RootUser' })
      .setValues({ user: { powers } }, true)
      .run();
  }

  async mergeRootAdminUserToSecurityGroup(id: string) {
    return await this.db
      .query()
      .match([
        [
          node('sg', 'RootSecurityGroup', {
            id,
          }),
        ],
      ])
      .with('*')
      .match(node('newRootAdmin', 'RootUser'))
      .with('*')
      .merge([
        [
          node('sg'),
          relation('out', 'adminLink', 'member'),
          node('newRootAdmin'),
        ],
      ])
      // .setValues({ sg: RootSecurityGroup })
      .return('newRootAdmin')
      .first();
  }

  async mergePublicSecurityGroupWithRootSg(
    publicSecurityGroupId: string,
    rootSecurityGroupId: string
  ) {
    await this.db
      .query()
      .merge([
        node('publicSg', ['PublicSecurityGroup', 'SecurityGroup'], {
          id: publicSecurityGroupId,
        }),
      ])
      .onCreate.setValues({
        publicSg: {
          id: publicSecurityGroupId,
        },
      })
      .setLabels({ publicSg: 'SecurityGroup' })
      .with('*')
      .match([
        node('rootSg', 'RootSecurityGroup', {
          id: rootSecurityGroupId,
        }),
      ])
      .merge([node('publicSg'), relation('out', '', 'member'), node('rootSg')])
      .run();
  }

  async checkDefaultOrg() {
    return await this.db
      .query()
      .match([node('org', 'DefaultOrganization')])
      .return('org.id as id')
      .first();
  }

  async doesOrgExist(defaultOrgName: string) {
    return await this.db
      .query()
      .match([
        node('org', 'Organization'),
        relation('out', '', 'name'),
        node('name', 'Property', {
          value: defaultOrgName,
        }),
      ])
      .return('org')
      .first();
  }

  async giveOrgDefaultLabel(defaultOrgName: string) {
    return await this.db
      .query()
      .match([
        node('org', 'Organization'),
        relation('out', '', 'name'),
        node('name', 'Property', {
          value: defaultOrgName,
        }),
      ])
      .setLabels({ org: 'DefaultOrganization' })
      .return('org.id as id')
      .first();
  }

  async createOrgResult(
    orgSgId: ID,
    createdAt: DateTime,
    publicSecurityGroupId: string,
    defaultOrgId: string,
    defaultOrgName: string
  ) {
    return await this.db
      .query()
      .match(
        node('publicSg', 'PublicSecurityGroup', {
          id: publicSecurityGroupId,
        })
      )
      .match(node('rootuser', 'RootUser'))
      .create([
        node('orgSg', ['OrgPublicSecurityGroup', 'SecurityGroup'], {
          id: orgSgId,
        }),
        relation('out', '', 'organization'),
        node('org', ['DefaultOrganization', 'Organization'], {
          id: defaultOrgId,
          createdAt,
        }),
        relation('out', '', 'name', { active: true, createdAt }),
        node('name', 'Property', {
          createdAt,
          value: defaultOrgName,
        }),
      ])
      .with('*')
      .create([
        node('publicSg'),
        relation('out', '', 'permission'),
        node('perm', 'Permission', {
          property: 'name',
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('org'),
      ])
      .with('*')
      .create([node('orgSg'), relation('out', '', 'member'), node('rootuser')])
      .return('org.id as id')
      .first();
  }
}
