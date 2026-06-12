import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { CryptoService } from '~/core/authentication/crypto.service';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { AdminDrizzleRepository } from './admin.drizzle.repository';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminDrizzleService implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    @Inject(AdminRepository) private readonly repo: AdminDrizzleRepository,
    private readonly moduleRef: ModuleRef,
    @Logger('admin:service') private readonly logger: ILogger,
  ) {}

  @Once() private get crypto() {
    return this.moduleRef.get(CryptoService, { strict: false });
  }

  async onApplicationBootstrap(): Promise<void> {
    const finishing = this.repo.finishing(async () => {
      await this.setupRootUser();
      await this.setupDefaultOrg();
    });
    // Wait for root object setup when running tests, else just let it run in
    // the background and allow webserver to start.
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

  // Projects FK their owning organization to this row (config.defaultOrg),
  // so it has to exist before the first project insert — same job as the
  // Neo4j AdminService's mergeDefaultOrg.
  private async setupDefaultOrg(): Promise<void> {
    const { id, name } = this.config.defaultOrg;
    await this.repo.mergeDefaultOrg(id, name);
  }

  private async setupRootUser(): Promise<void> {
    const root = this.config.rootUser;

    const existing = await this.repo.doesRootUserExist();
    if (!existing) {
      this.logger.notice('Setting up root user');
      const hashed = await this.crypto.hash(root.password);
      await this.repo.createRootUser(root.id, root.email, hashed);
      return;
    }

    if (root.id !== existing.id) {
      this.logger.notice(
        'Stored root user ID differs from config, using stored value',
      );
      // TODO hack. Change notification handlers to pull from DB, instead of config
      Object.assign(this.config.rootUser, { id: existing.id });
    }

    const passwordSame = await this.crypto
      .verify(existing.hash, root.password)
      .catch(() => false);
    if (existing.email !== root.email || !passwordSame) {
      this.logger.notice('Updating root user to match app configuration');
      await this.repo.updateEmail(root.id, root.email);
      if (!passwordSame) {
        const hashed = await this.crypto.hash(root.password);
        await this.repo.auth.savePasswordHashOnUser(root.id, hashed);
      }
    }
  }
}
