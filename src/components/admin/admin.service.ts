import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ServerException } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  Transactional,
} from '../../core';
import { AuthenticationService } from '../authentication';
import { CryptoService } from '../authentication/crypto.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
import { Role } from '../project';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly authentication: AuthenticationService,
    private readonly crypto: CryptoService,
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
  private async setupRootObjects(): Promise<void> {
    this.logger.debug('Setting up root objects');

    await this.mergeRootSecurityGroup();

    await this.mergePublicSecurityGroup();

    await this.mergeAnonUser();

    await this.mergeRootAdminUser();

    await this.mergeRootAdminUserToSecurityGroup();

    await this.mergePublicSecurityGroupWithRootSg();

    await this.mergeDefaultOrg();
  }

  private async mergeRootSecurityGroup() {
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

  private async mergePublicSecurityGroup() {
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

  private async mergeAnonUser() {
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

  private async mergeRootAdminUser(): Promise<void> {
    const { email, password } = this.config.rootAdmin;

    let id: string;

    // see if root already exists
    const existing = await this.db
      .query()
      .match([
        node('email', 'EmailAddress'),
        relation('in', '', 'email', { active: true }),
        node('root', ['RootUser']),
        relation('out', '', 'password', { active: true }),
        node('pw', 'Property'),
      ])
      .return(['root.id as id', 'email.value as email', 'pw.value as hash'])
      .asResult<{ id: string; email: string; hash: string }>()
      .first();
    if (existing) {
      if (
        existing.email !== email ||
        !(await this.crypto.verify(existing.hash, password))
      ) {
        this.logger.notice('Updating root user to match app configuration');
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
            pw: { value: await this.crypto.hash(password) },
          })
          .run();
      }
      id = existing.id;
    } else {
      id = await this.authentication.register({
        email,
        password,
        displayFirstName: 'root',
        displayLastName: 'root',
        realFirstName: 'root',
        realLastName: 'root',
        phone: 'root',
        about: 'root',
        roles: [Role.Administrator], // do not give root all the roles
      });

      // set root user label & give all powers
      const powers = Object.keys(Powers);
      await this.db
        .query()
        .matchNode('user', 'User', { id })
        .setLabels({ user: 'RootUser' })
        .setValues({ user: { powers } }, true)
        .run();
    }

    // TODO do this a different way. Using a global like this can cause race conditions.
    this.config.rootAdmin.id = id;
    this.logger.notice('Setting actual root user id', { id });
  }

  private async mergeRootAdminUserToSecurityGroup(): Promise<void> {
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

  private async mergePublicSecurityGroupWithRootSg(): Promise<void> {
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

  private async mergeDefaultOrg(): Promise<void> {
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
