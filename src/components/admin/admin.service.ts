import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DateTime } from 'luxon';
import { generateId, ID, ServerException } from '../../common';
import { ConfigService, ILogger, Logger, Transactional } from '../../core';
import { AuthenticationService } from '../authentication';
import { CryptoService } from '../authentication/crypto.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
import { Role } from '../project';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    private readonly authentication: AuthenticationService,
    private readonly crypto: CryptoService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: AdminRepository,
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
    const finishing = this.repo.finishing(() => this.setupRootObjects());
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
    const apoc = await this.repo.apocVersion();
    if (apoc) {
      this.logger.info('Found Neo4j APOC plugin', { version: apoc });
    } else {
      this.logger.error('Neo4j APOC plugin not loaded');
    }

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
    const id = this.config.rootSecurityGroup.id;

    await this.repo.mergeRootSecurityGroup(powers, id);
  }

  private async mergePublicSecurityGroup() {
    const id = this.config.publicSecurityGroup.id;
    await this.repo.mergePublicSecurityGroup(id);
  }

  private async mergeAnonUser() {
    const createdAt = DateTime.local();
    const anonUserId = this.config.anonUser.id;
    const publicSecurityGroupId = this.config.publicSecurityGroup.id;

    await this.repo.mergeAnonUser(createdAt, anonUserId, publicSecurityGroupId);
  }

  private async mergeRootAdminUser(): Promise<void> {
    const { email, password } = this.config.rootAdmin;

    let id: ID;

    // see if root already exists
    const existing = await this.repo.checkExistingRoot();
    if (existing) {
      if (
        existing.email !== email ||
        !(await this.crypto.verify(existing.hash, password))
      ) {
        this.logger.notice('Updating root user to match app configuration');
        const hashedPassword = await this.crypto.hash(password);
        await this.repo.mergeRootAdminUser(email, hashedPassword);
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
      await this.repo.setUserLabel(powers, id);
    }

    // TODO do this a different way. Using a global like this can cause race conditions.
    this.config.rootAdmin.id = id;
    this.logger.notice('Setting actual root user id', { id });
  }

  private async mergeRootAdminUserToSecurityGroup(): Promise<void> {
    const id = this.config.rootSecurityGroup.id;
    const makeAdmin = await this.repo.mergeRootAdminUserToSecurityGroup(id);

    if (!makeAdmin) {
      throw new ServerException(
        'Could not merge root admin user to security group'
      );
    }
  }

  private async mergePublicSecurityGroupWithRootSg(): Promise<void> {
    const publicSecurityGroupId = this.config.publicSecurityGroup.id;
    const rootSecurityGroupId = this.config.rootSecurityGroup.id;

    await this.repo.mergePublicSecurityGroupWithRootSg(
      publicSecurityGroupId,
      rootSecurityGroupId
    );
  }

  private async mergeDefaultOrg(): Promise<void> {
    // is there a default org
    const isDefaultOrgResult = await this.repo.checkDefaultOrg();

    if (!isDefaultOrgResult) {
      // is there an org with the soon-to-be-created defaultOrg's name
      const defaultOrgName = this.config.defaultOrg.name;
      const doesOrgExist = await this.repo.doesOrgExist(defaultOrgName);

      if (doesOrgExist) {
        // add label to org

        const giveOrgDefaultLabel = await this.repo.giveOrgDefaultLabel(
          defaultOrgName
        );

        if (!giveOrgDefaultLabel) {
          throw new ServerException('could not create default org');
        }
      } else {
        // create org
        const orgSgId = await generateId();
        const createdAt = DateTime.local();
        const publicSecurityGroupId = this.config.publicSecurityGroup.id;
        const defaultOrgId = this.config.defaultOrg.id;
        const defaultOrgName = this.config.defaultOrg.name;

        const createOrgResult = await this.repo.createOrgResult(
          orgSgId,
          createdAt,
          publicSecurityGroupId,
          defaultOrgId,
          defaultOrgName
        );

        if (!createOrgResult) {
          throw new ServerException('failed to create default org');
        }
      }
    }
  }
}
