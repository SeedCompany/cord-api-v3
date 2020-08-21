import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ServerException, UnauthenticatedException } from '../../common';
import { ConfigService, DatabaseService } from '../../core';
import { AuthenticationService } from '../authentication';
import { RootSecurityGroup } from './root-security-group';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly authentication: AuthenticationService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // merge root security group
    await this.mergeRootSecurityGroup();

    // merge public security group
    await this.mergePublicSecurityGroup();

    // merge anon user and connect to public sg
    await this.mergeAnonUser();

    // Root Admin

    if (!(await this.doesRootAdminUserAlreadyExist())) {
      await this.createRootAdminUser();
    }

    // Connect Root Security Group and Root Admin

    await this.mergeRootAdminUserToSecurityGroup();

    await this.mergePublicSecurityGroupWithRootSg();

    // Default Organization
    await this.mergeDefaultOrg();
  }

  async mergeRootSecurityGroup() {
    // merge root security group
    const createdAt = DateTime.local();
    await this.db
      .query()
      .merge([
        node('sg', 'RootSecurityGroup', {
          id: this.config.rootSecurityGroup.id,
        }),
      ])
      .onCreate.setLabels({ sg: ['RootSecurityGroup', 'SecurityGroup'] })
      .setValues({
        sg: {
          createdAt,
          active: true,
          id: this.config.rootSecurityGroup.id,
          ...RootSecurityGroup,
        },
      })
      .run();
  }

  async mergePublicSecurityGroup() {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .merge([
        node('sg', 'PublicSecurityGroup', {
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .onCreate.setLabels({ sg: ['PublicSecurityGroup', 'SecurityGroup'] })
      .setValues({
        'sg.createdAt': createdAt,
        'sg.active': true,
        'sg.id': this.config.publicSecurityGroup.id,
      })
      .run();
  }

  async mergeAnonUser() {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .merge([
        node('anon', 'AnonUser', {
          id: this.config.anonUser.id,
        }),
      ])
      .onCreate.setLabels({ anon: ['AnonUser', 'User', 'BaseNode'] })
      .setValues({
        'anon.createdAt': createdAt,
        'anon.active': true,
        'anon.id': this.config.anonUser.id,
      })
      .with('*')
      .match([
        node('publicSg', 'PublicSecurityGroup', {
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .merge([node('publicSg'), relation('out', '', 'member'), node('anon')])
      .run();
  }

  async doesRootAdminUserAlreadyExist(): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        [
          node('user', 'User', {
            id: this.config.rootAdmin.id,
          }),
          relation('out', '', 'email', {
            active: true,
          }),
          node('email', 'EmailAddress', {
            value: this.config.rootAdmin.email,
          }),
        ],
      ])
      .return('user')
      .first();

    if (result) {
      return true;
    } else {
      return false;
    }
  }

  async createRootAdminUser(): Promise<void> {
    const { email, password } = this.config.rootAdmin;

    // see if root already exists
    const findRoot = await this.db
      .query()
      .match([
        node('email', 'EmailAddress', { active: true, value: email }),
        relation('in', '', 'email', { active: true }),
        node('root', ['User', 'RootAdmin'], { active: true }),
        relation('out', '', 'password', { active: true }),
        node('pw', 'Propety'),
      ])
      .return('pw.value as pash')
      .first();

    if (findRoot === undefined) {
      // not found, create

      const adminUser = await this.authentication.register({
        email: email,
        password,
        displayFirstName: 'root',
        displayLastName: 'root',
        realFirstName: 'root',
        realLastName: 'root',
        phone: 'root',
        timezone: 'root',
        bio: 'root',
      });

      if (!adminUser) {
        throw new ServerException('Could not create root admin user');
      } else {
        // set root admin id to config value
        await this.db
          .query()
          .match([
            node('user', 'User', {
              id: adminUser,
            }),
          ])
          .setValues({ 'user.id': this.config.rootAdmin.id })
          .run();
      }
    } else if (await argon2.verify(findRoot.pash, password)) {
      // password match - do nothing
    } else {
      // password did not match

      throw new UnauthenticatedException(
        'Root Email or Password are incorrect'
      );
    }
  }

  async mergeRootAdminUserToSecurityGroup(): Promise<void> {
    const makeAdmin = await this.db
      .query()
      .match([
        [
          node('sg', 'RootSecurityGroup', {
            id: this.config.rootSecurityGroup.id,
          }),
        ],
      ])
      .with('*')
      .match([
        [
          node('newRootAdmin', 'User', {
            id: this.config.rootAdmin.id,
          }),
        ],
      ])
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

    if (!makeAdmin) {
      throw new ServerException(
        'Could not merge root admin user to security group'
      );
    }
  }

  async mergePublicSecurityGroupWithRootSg(): Promise<void> {
    const createdAt = DateTime.local();
    await this.db
      .query()
      .merge([
        node('publicSg', ['PublicSecurityGroup', 'SecurityGroup'], {
          active: true,
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .onCreate.setValues({
        publicSg: {
          id: this.config.publicSecurityGroup.id,
          createdAt,
          active: true,
        },
      })
      .setLabels({ publicSg: 'SecurityGroup' })
      .with('*')
      .match([
        node('rootSg', 'RootSecurityGroup', {
          id: this.config.rootSecurityGroup.id,
        }),
      ])
      .merge([node('publicSg'), relation('out', '', 'member'), node('rootSg')])
      .run();
  }

  async mergeDefaultOrg(): Promise<void> {
    // is there a default org
    const isDefaultOrgResult = await this.db
      .query()
      .match([
        node('org', 'DefaultOrganization', {
          active: true,
        }),
      ])
      .return('org.id as id')
      .first();

    if (!isDefaultOrgResult) {
      // is there an org with the soon-to-be-created defaultOrg's name
      const doesOrgExist = await this.db
        .query()
        .match([
          node('org', 'Organization', {
            active: true,
          }),
          relation('out', '', 'name'),
          node('name', 'Property', {
            active: true,
            value: this.config.defaultOrg.name,
          }),
        ])
        .return('org')
        .first();

      if (doesOrgExist) {
        // add label to org
        const giveOrgDefaultLabel = await this.db
          .query()
          .match([
            node('org', 'Organization', {
              active: true,
            }),
            relation('out', '', 'name'),
            node('name', 'Property', {
              active: true,
              value: this.config.defaultOrg.name,
            }),
          ])
          .setLabels({ org: 'DefaultOrganization' })
          .return('org.id as id')
          .first();

        if (!giveOrgDefaultLabel) {
          throw new ServerException('could not create default org');
        }
      } else {
        // create org
        const orgSgId = generate();
        const createdAt = DateTime.local();
        const createOrgResult = await this.db
          .query()
          .match(
            node('publicSg', 'PublicSecurityGroup', {
              active: true,
              id: this.config.publicSecurityGroup.id,
            })
          )
          .match(
            node('rootuser', 'User', {
              active: true,
              id: this.config.rootAdmin.id,
            })
          )
          .create([
            node('orgSg', ['OrgPublicSecurityGroup', 'SecurityGroup'], {
              active: true,
              id: orgSgId,
              createdAt,
            }),
            relation('out', '', 'organization'),
            node('org', ['DefaultOrganization', 'Organization'], {
              active: true,
              id: this.config.defaultOrg.id,
              createdAt,
            }),
            relation('out', '', 'name', { active: true, createdAt }),
            node('name', 'Property', {
              active: true,
              createdAt,
              value: this.config.defaultOrg.name,
            }),
          ])
          .with('*')
          .create([
            node('publicSg'),
            relation('out', '', 'permission', {
              active: true,
            }),
            node('perm', 'Permission', {
              active: true,
              property: 'name',
              read: true,
            }),
            relation('out', '', 'baseNode', { active: true }),
            node('org'),
          ])
          .with('*')
          .create([
            node('orgSg'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ])
          .return('org.id as id')
          .first();

        if (!createOrgResult) {
          throw new ServerException('failed to create default org');
        }
      }
    }
  }
}
