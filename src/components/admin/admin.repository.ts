import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { fromPairs } from 'lodash';
import { DateTime } from 'luxon';
import { table } from 'node:console';
import { Pool } from 'pg';
import { ID } from '../../common';
import { ConfigService, DatabaseService, SyntaxError } from '../../core';
import { PostgresService } from '../../core/postgres/postgres.service';

@Injectable()
export class AdminRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly pg: PostgresService,
    private readonly config: ConfigService
  ) {}

  async loadData() {
    // default inserts
    // await this.pg.client.end();
    const pool = this.pg.pool;
    const client = await pool.connect();
    let pool2 = new Pool(this.config.postgres);
    try {
      await client.query(
        `insert into public.people_data("id", "public_first_name") values($1, $2)`,
        [0, 'defaultPerson']
      );
      await client.query(
        `insert into public.organizations_data("id", "name") values($1, $2)`,
        [0, 'defaultOrg']
      );
      await client.query(
        `insert into public.users_data("id", "person", "email","owning_org", "password") values(0,0,'defaultEmail', 0, 'abc')`
      );
      await client.query(
        `insert into public.global_roles_data("id","name", "org") values(0,'defaultRole',0)`
      );

      // inserting a lot of data
      for (let i = 1; i < 2; i++) {
        const orgName = `org${i}`;
        const personName = `person${i}`;
        const locationName = `location${i}`;
        const userData = {
          email: `email${i}`,
          password: 'abc',
          org: 'defaultOrg',
        };
        const roleData = { name: `role${i}`, org: 'defaultOrg' };
        await client.query(
          `insert into public.organizations_data("id", "name") values($1, $2)`,
          [i, orgName]
        );
        await client.query(
          `insert into public.locations_data("name", "sensitivity", "type") values($1, 'Low', 'Country')`,
          [locationName]
        );
        await client.query(`select * from public.sys_register($1,$2,$3)`, [
          userData.email,
          userData.password,
          userData.org,
        ]);
        await client.query(`select * from public.sys_create_role($1, $2)`, [
          roleData.name,
          roleData.org,
        ]);
      }

      // adding grants and memberships
      // 1. get the table name and column names
      // 2. add grants to half of them (odd/even)
      // 3. grant memberships to half the members (odd/even)

      const tables = await client.query(
        `select table_name from information_schema.tables where table_schema = 'public' and table_name like '%_data' order by table_name`
      );
      console.log(tables.rows);
      tables.rows.forEach(async (tableRow) => {
        const columns = await client.query(
          `select column_name from information_schema.columns where table_schema='public' and table_name = $1`,
          [tableRow.table_name]
        );
        const schemaTableName = `public.${tableRow.table_name}`;
        console.log(schemaTableName);
        columns.rows.forEach(async (columnRow, index) => {
          const accessLevel = index % 2 === 0 ? 'Read' : 'Write';
          console.log(schemaTableName, columnRow.column_name, accessLevel);
          await client.query(
            `select * from public.sys_add_role_grant($1, $2, $3, $4, $5 )`,
            [
              'defaultRole',
              'defaultOrg',
              schemaTableName,
              columnRow.column_name,
              accessLevel,
            ]
          );
        });
      });

      // add role member
      const users = await client.query(`select person from public.users_data`);
      console.log(users.rows);

      users.rows.forEach(async (row, index) => {
        await client.query(
          `insert into public.global_role_memberships_data("person", "global_role") values($1, 0)`,
          [row.person]
        );
      });
      console.log('creating new pool');
      // await client.release();
      // await pool.end();
      // const pool2 = new Pool(this.config.postgres);
      const client2 = await pool2.connect();
      // add project members and roles
      for (let i = 1; i < 2; i++) {
        const projName = `proj${i}`;
        const projectRole = `projRole${i}`;
        await client2.query(
          `insert into public.projects_data("name") values ($1) on conflict do nothing;`,
          [projName]
        );
        await client2.query(
          `insert into public.project_roles_data("name", "org") values ($1, 0) on conflict do nothing`,
          [projectRole]
        );
        await client2.query(
          `insert into public.project_memberships_data("person", "project") values (0,$1) on conflict do nothing;`,
          [i]
        );
        await client2.query(
          `insert into public.project_member_roles_data("person", "project", "project_role") values (1, $1, 1) on conflict do nothing;`,
          [i]
        );
      }
      await client2.query(`insert into public.project_role_column_grants_data("access_level","column_name", "project_role", "table_name")
      values('Write', 'name', 1, 'public.locations_data' );`);
      console.log('done');
    } catch (e) {
      console.log(e.message);
    }
    // finally {
    //   await client.release();
    //   await pool.end();
    //   await pool2.end();
    // }
    
    return true;
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
