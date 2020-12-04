/* eslint-disable prettier/prettier */
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { pickBy } from 'lodash';
import { Except } from 'type-fest';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { DbV4 } from '../../core/database/v4/dbv4.service';
import { AuthenticationService } from '../authentication';
import { AuthorizationService } from '../authorization/authorization.service';
import { Role } from '../project';
import { BootstrapIn, BootstrapOut } from './admin.dto';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly dbv4: DbV4,
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

  async setupRootObjects(): Promise<void> {
    this.logger.notice('bootstrapping...');
    const passwordHash = await argon2.hash(
      this.config.rootAdmin.password,
      this.argon2Options
    );
    const input: BootstrapIn = {
      rootEmail: this.config.rootAdmin.email,
      rootPash: passwordHash,
      defaultOrgId: this.config.defaultOrg.id,
      defaultOrgName: this.config.defaultOrg.name,
    };
    const result = await this.dbv4.post<BootstrapOut>('admin/bootstrap', input);
    this.config.setRootAdminId(result.rootAdminId);
    this.logger.notice(`root admin id`, { id: result.rootAdminId });
  }

  private get argon2Options() {
    const options: Except<argon2.Options, 'raw'> = {
      secret: this.config.passwordSecret
        ? Buffer.from(this.config.passwordSecret, 'utf-8')
        : undefined,
    };
    // argon doesn't like undefined values even though the types allow them
    return pickBy(options, (v) => v !== undefined);
  }
}
