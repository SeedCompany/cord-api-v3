import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '../../common';
import { DatabaseService, SyntaxError } from '../../core';
import { ACTIVE } from '../../core/database/query';

@Injectable()
export class AdminRepository {
  constructor(private readonly db: DatabaseService) {}

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
        relation('in', '', 'email', ACTIVE),
        node('root', ['RootUser']),
        relation('out', '', 'password', ACTIVE),
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
        relation('in', '', 'email', ACTIVE),
        node('root', ['RootUser']),
        relation('out', '', 'password', ACTIVE),
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
