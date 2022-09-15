import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ID, ServerException } from '../../common';
import { ConfigService, ILogger, Logger, Transactional } from '../../core';
import { AuthenticationService } from '../authentication';
import { CryptoService } from '../authentication/crypto.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers, Role } from '../authorization/dto';
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

  async onApplicationBootstrap(): Promise<void> {
    const finishing = this.repo.finishing(() => this.setupRootObjects());
    // Wait for root object setup when running tests, else just let it run in
    // background and allow webserver to start.
    if (this.config.jest || this.config.isRepl) {
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

    await this.mergeAnonUser();

    await this.mergeRootAdminUser();

    await this.mergeDefaultOrg();
  }

  private async mergeAnonUser() {
    const createdAt = DateTime.local();
    const anonUserId = this.config.anonUser.id;
    await this.repo.mergeAnonUser(createdAt, anonUserId);
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
        displayFirstName: 'Root',
        displayLastName: 'Admin',
        realFirstName: 'Root',
        realLastName: 'Admin',
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
        const createdAt = DateTime.local();
        const defaultOrgId = this.config.defaultOrg.id;
        const defaultOrgName = this.config.defaultOrg.name;

        const createOrgResult = await this.repo.createOrgResult(
          createdAt,
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
