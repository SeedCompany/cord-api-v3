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
import { ConfigService, DatabaseService, ILogger, Logger, Transactional } from '../../core';
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

  async addRolesToBetaTesters() {
    await this.authorizationService.roleAddedToUser(
      '5c3d887b7219425288a3cb18',
      [Role.ProjectManager, Role.RegionalDirector, Role.FieldOperationsDirector]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88787219425288a3cb00',
      [Role.FinancialAnalyst]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88927219425288a3cbbd',
      [Role.ProjectManager]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88967219425288a3cbde',
      [Role.ProjectManager, Role.Consultant]
    );
    await this.authorizationService.roleAddedToUser(
      '5c41616572194246f451c9f1',
      [Role.FinancialAnalyst]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d888d7219425288a3cb9d',
      [Role.FinancialAnalyst]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88a37219425288a3cc36',
      [Role.ProjectManager]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88757219425288a3caef',
      [Role.ProjectManager]
    );
    await this.authorizationService.roleAddedToUser(
      '5c5dfbd41e560f7f00c0a60f',
      [Role.ConsultantManager, Role.Consultant]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d887f7219425288a3cb36',
      [Role.FinancialAnalyst, Role.Controller]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d887f7219425288a3cb35',
      [Role.ProjectManager]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88947219425288a3cbd1',
      [Role.ProjectManager]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88767219425288a3caf6',
      [Role.ProjectManager, Role.RegionalDirector]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88807219425288a3cb3b',
      [Role.ProjectManager, Role.ConsultantManager, Role.Consultant]
    );
    await this.authorizationService.roleAddedToUser(
      '5d7fae2d5ad0b4138837dcb2',
      [Role.Fundraising]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88a07219425288a3cc21',
      [Role.Marketing]
    );
    await this.authorizationService.roleAddedToUser(
      '5cab92561c65854a8c7ab411',
      [Role.StaffMember]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88a17219425288a3cc29',
      [Role.Fundraising]
    );
    await this.authorizationService.roleAddedToUser(
      '5c4b45cd7e96a6317139f001',
      [Role.Marketing]
    );
    await this.authorizationService.roleAddedToUser(
      '5c5daa2425cb4768cdabe655',
      [Role.ConsultantManager]
    );
    await this.authorizationService.roleAddedToUser(
      '5c3d88907219425288a3cbb1',
      [Role.ConsultantManager]
    );
  }

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

  @Transactional()
  async setupRootObjects(): Promise<void> {
    this.logger.debug('Setting up root objects');

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

    const powers = Object.keys(Powers);

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
          id: this.config.rootSecurityGroup.id,
          powers,
        },
      })
      .run();
  }

  async mergePublicSecurityGroup() {
    await this.db
      .query()
      .merge([
        node('sg', 'PublicSecurityGroup', {
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .onCreate.setLabels({ sg: ['PublicSecurityGroup', 'SecurityGroup'] })
      .setValues({
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
    await this.db
      .query()
      .merge([
        node('publicSg', ['PublicSecurityGroup', 'SecurityGroup'], {
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .onCreate.setValues({
        publicSg: {
          id: this.config.publicSecurityGroup.id,
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
            node('publicSg', 'PublicSecurityGroup', {
              id: this.config.publicSecurityGroup.id,
            })
          )
          .match(
            node('rootuser', 'User', {
              id: this.config.rootAdmin.id,
            })
          )
          .create([
            node('orgSg', ['OrgPublicSecurityGroup', 'SecurityGroup'], {
              id: orgSgId,
            }),
            relation('out', '', 'organization'),
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
          .create([
            node('orgSg'),
            relation('out', '', 'member'),
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
