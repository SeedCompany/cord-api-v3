import {
  Injectable,
  OnApplicationBootstrap,
  InternalServerErrorException as ServerException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { ConfigService, DatabaseService } from '../../core';
import { UserService } from '../user';
import { RootSecurityGroup } from './root-security-group';
import { generate } from 'shortid';
import { DateTime } from 'luxon';
import { OrganizationService } from '../organization';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly userService: UserService,
    private readonly orgService: OrganizationService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Root Security Group

    if (!(await this.rootAdminSecurityGroupExists())) {
      await this.createRootAdminSecurityGroup();
    }

    // Root Admin

    if (!(await this.doesRootAdminUserAlreadyExist())) {
      await this.createRootAdminUser();
    }

    // Connect Root Security Group and Root Admin

    await this.mergeRootAdminUserToSecurityGroup();

    await this.mergePublicSecurityGroup();

    // Default Organization
    await this.mergeDefaultOrg();
  }

  async rootAdminSecurityGroupExists(): Promise<boolean> {
    const result = await this.db
      .query()
      .match(
        node('sg', 'RootSecurityGroup', {
          active: true,
        })
      )
      .return('sg')
      .first();

    return !!result;
  }

  async createRootAdminSecurityGroup(): Promise<void> {
    const id = generate();
    const createdAt = DateTime.local();
    const result = await this.db
      .query()
      .create([
        node('sg', ['RootSecurityGroup', 'SecurityGroup'], {
          active: true,
          id,
          createdAt,
          ...RootSecurityGroup,
        }),
      ])
      .return('sg')
      .first();

    if (!result) {
      throw new ServerException('Could not create root admin security group.');
    }
  }

  async doesRootAdminUserAlreadyExist(): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        [
          node('user', 'User'),
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
      const adminUser = await this.userService.create({
        email: email,
        password: password,
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
      }
    } else if (await argon2.verify(findRoot.pash, password)) {
      // password match - do nothing
    } else {
      // password did not match

      throw new UnauthorizedException('Root Email or Password are incorrect');
    }
  }

  async mergeRootAdminUserToSecurityGroup(): Promise<void> {
    const makeAdmin = await this.db
      .query()
      .match([[node('sg', 'RootSecurityGroup')]])
      .with('*')
      .match([
        [
          node('newRootAdmin', 'User'),
          relation('out', '', 'email', {
            active: true,
          }),
          node('emailAddress', 'EmailAddress', {
            value: this.config.rootAdmin.email,
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

  async mergePublicSecurityGroup(): Promise<void> {
    const id = generate();
    const createdAt = DateTime.local();
    const result = await this.db
      .query()
      .merge([
        node('publicSg', ['PublicSecurityGroup', 'SecurityGroup'], {
          active: true,
        }),
      ])
      .onCreate.setValues({
        publicSg: { id, createdAt: createdAt.toString(), active: true },
      })
      .setLabels({ publicSg: 'SecurityGroup' })
      .with('*')
      .merge([node('rootSg', 'RootSecurityGroup')])
      .with('*')
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
      .return('org')
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
          .return('org')
          .run();

        if (!giveOrgDefaultLabel) {
          throw new ServerException('could not create default org');
        }
      } else {
        // create org
        const id = generate();
        const createdAt = DateTime.local().toString();
        const createOrgResult = await this.db
          .query()
          .create([
            node('org', ['DefaultOrganization', 'Organization'], {
              active: true,
              id,
              createdAt,
            }),
            relation('out', '', 'name', { active: true, createdAt }),
            node('name', 'Property', {
              active: true,
              createdAt,
              value: this.config.defaultOrg.name,
            }),
          ])
          .return('org')
          .first();

        if (!createOrgResult) {
          throw new ServerException('failed to create default org');
        }
      }
    }
  }
}
