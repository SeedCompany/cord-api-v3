import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ID, Role, ServerException } from '~/common';
import { ConfigService } from '~/core/config/config.service';
import { Transactional } from '~/core/database';
import { ILogger, Logger } from '~/core/logger';
import { AuthenticationService } from '../authentication';
import { CryptoService } from '../authentication/crypto.service';
import { Power } from '../authorization/dto';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    private readonly authentication: AuthenticationService,
    private readonly crypto: CryptoService,
    private readonly repo: AdminRepository,
    @Logger('admin:service') private readonly logger: ILogger,
    @Logger('admin:database') private readonly dbLogger: ILogger,
  ) {}

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
    // @ts-expect-error ahh I'm just being lazy.
    this.repo.db.conn.currentTransaction!.queryLogger = this.dbLogger;

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
        !(await this.crypto.verify(existing.hash, password).catch(() => false))
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
      await this.repo.setUserLabel([...Power.values], id);
    }

    // TODO do this a different way. Using a global like this can cause race conditions.
    // @ts-expect-error this is the one spot we are conceding mutable.
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
          defaultOrgName,
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
          defaultOrgName,
        );

        if (!createOrgResult) {
          throw new ServerException('failed to create default org');
        }
      }
    }
  }
}
