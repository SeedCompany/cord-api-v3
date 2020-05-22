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

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly userService: UserService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!(await this.rootAdminSecurityGroupExists())) {
      await this.createRootAdminSecurityGroup();
    }

    if (!(await this.doesRootAdminUserAlreadyExist())) {
      await this.createRootAdminUser();
    }

    await this.mergeRootAdminUserToSecurityGroup();
  }

  async rootAdminSecurityGroupExists(): Promise<boolean> {
    const result = await this.db
      .query()
      .match(node('sg', 'RootSecurityGroup'))
      .return('sg')
      .first();

    return !!result;
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

  async createRootAdminSecurityGroup(): Promise<void> {
    const result = await this.db
      .query()
      .create([
        [node('sg', ['RootSecurityGroup', 'SecurityGroup'], RootSecurityGroup)],
      ])
      .return('sg')
      .first();

    if (!result) {
      throw new ServerException('Could not create root admin security group.');
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
        node('root', 'User', { active: true }),
        relation('out', '', 'password', { active: true }),
        node('pw', 'Property'),
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
      .setValues({ sg: RootSecurityGroup })
      .return('newRootAdmin')
      .first();

    if (!makeAdmin) {
      throw new ServerException(
        'Could not merge root admin user to security group'
      );
    }
  }
}
