/* eslint-disable prettier/prettier */
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ServerException,
  UnauthenticatedException,
} from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { AuthenticationService } from '../authentication';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
import { Role } from '../project';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly authentication: AuthenticationService,
    private readonly authorizationService: AuthorizationService,
    @Logger('admin:service') private readonly logger: ILogger
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const finishing = this.db.runOnceUntilCompleteAfterConnecting(() =>
      this.setupRootObjects()
    );
    // Wait for root object setup when running tests, else just let it run in
    // background and allow webserver to start.
    if (this.config.jest) {
      await finishing;
    } else {
      finishing.catch((exception) => {
        this.logger.error('Failed to setup root objects', {
          exception,
        });
      });
    }
  }

  async setupRootObjects(): Promise<void> {
    // Root Admin
    if (!(await this.doesRootAdminUserAlreadyExist())) {
      await this.createRootAdminUser();
    }

    // Default Organization
    await this.mergeDefaultOrg();
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
      .raw('RETURN user.id as id')
      .first();

    if (result) {
      // set id to root user id
      this.config.setRootAdminId(result.id);
      this.logger.notice(`root admin id`, { id: result.id });
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
        node('email', 'EmailAddress', { value: email }),
        relation('in', '', 'email', { active: true }),
        node('root', ['User', 'RootAdmin']),
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
        about: 'root',
        roles: [Role.Administrator], // do not give root all the roles
      });

      // update config with new root admin id
      this.config.setRootAdminId(adminUser);
      this.logger.notice('root user id: ' + adminUser);

      if (!adminUser) {
        throw new ServerException('Could not create root admin user');
      } else {
        // give all powers
        const powers = Object.keys(Powers);
        await this.db
          .query()
          .match([
            node('user', 'User', {
              id: adminUser,
            }),
          ])
          .setValues({ user: { powers: powers } }, true)
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

  async mergeDefaultOrg(): Promise<void> {
    // is there a default org
    const isDefaultOrgResult = await this.db
      .query()
      .match([node('org', 'DefaultOrganization')])
      .return('org.id as id')
      .first();

    if (!isDefaultOrgResult) {
      // is there an org with the soon-to-be-created defaultOrg's name
      const doesOrgExist = await this.db
        .query()
        .match([
          node('org', 'Organization'),
          relation('out', '', 'name'),
          node('name', 'Property', {
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
            node('org', 'Organization'),
            relation('out', '', 'name'),
            node('name', 'Property', {
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
        const orgSgId = await generateId();
        const createdAt = DateTime.local();
        const createOrgResult = await this.db
          .query()
          .match(
            node('rootuser', 'User', {
              id: this.config.rootAdmin.id,
            })
          )
          .create([
            node('org', ['DefaultOrganization', 'Organization'], {
              id: this.config.defaultOrg.id,
              createdAt,
            }),
            relation('out', '', 'name', { active: true, createdAt }),
            node('name', 'Property', {
              createdAt,
              value: this.config.defaultOrg.name,
            }),
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
