import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '../../core';
import { QueryService } from '../../core/query/query.service';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly db2: QueryService,
    private readonly config: ConfigService
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.db2.mergeRootAdminUserAndSecurityGroup(
        this.config.rootAdmin.email,
        this.config.rootAdmin.password
      );
    });
  }
}
