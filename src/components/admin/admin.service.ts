import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ConfigService, DatabaseService } from '../../core';
import { UserService } from '../user';
import { RootSecurityGroup } from './root-security-group';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly userService: UserService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!(await this.rootAdminAclExists())) {
      await this.createRootAdminAcl();
    }

    if (!(await this.doesRootAdminUserAlreadyExist())) {
      await this.createRootAdminUser();
    }

    await this.mergeRootAdminUserToAcl();
  }

  async rootAdminAclExists(): Promise<boolean> {
    const result = await this.db
      .query()
      .match([[node('sg', 'RootSecurityGroup')]])
      .return('sg')
      .first();

    if (result) {
      return true;
    } else {
      return false;
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

  async createRootAdminAcl(): Promise<boolean> {
    const result = await this.db
      .query()
      .create([
        [
          node(
            'sg',
            ['RootSecurityGroup', 'SecurityGroup'],
            new RootSecurityGroup()
          ),
        ],
      ])
      .first();

    if (result) {
      return true;
    } else {
      return false;
    }
  }

  async createRootAdminUser(): Promise<boolean> {
    const { email, password } = this.config.rootAdmin;
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

    if (adminUser) {
      return true;
    } else {
      return false;
    }
  }

  async mergeRootAdminUserToAcl(): Promise<boolean> {
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
      .setValues({ sg: new RootSecurityGroup() })
      .return('newRootAdmin')
      .first();

    if (makeAdmin) {
      return true;
    } else {
      console.log('merge failed');
      return false;
    }
  }
}
