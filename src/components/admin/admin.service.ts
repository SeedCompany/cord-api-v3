import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { AdminRepository } from './admin.repository';

@Injectable()
export class AdminService implements OnApplicationBootstrap {
  constructor(
    private readonly config: ConfigService,
    @Inject(AdminRepository) private readonly repo: AdminRepository,
    @Logger('admin:service') private readonly logger: ILogger,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Same switch the Neo4j AdminService honors — also how read-only
    // maintenance mode keeps boot from writing.
    if (!this.config.dbRootObjectsSync) return;
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

  // Root authenticates via Auth0 like every other account — no password, no
  // break-glass fallback. This just ensures the `users` row exists with the
  // configured id/email, so `loginWithAuth0`'s ordinary "existing user,
  // match by email" path has something to find on root's first login.
  private async setupRootUser(): Promise<void> {
    const root = this.config.rootUser;

    const existing = await this.repo.findRootUser();
    if (!existing) {
      this.logger.notice('Setting up root user');
      await this.repo.createRootUser(root.id, root.email);
      return;
    }

    if (root.id !== existing.id) {
      this.logger.notice(
        'Stored root user ID differs from config, using stored value',
      );
      // TODO hack. Change notification handlers to pull from DB, instead of config
      Object.assign(this.config.rootUser, { id: existing.id });
    }

    if (existing.email !== root.email) {
      this.logger.notice('Updating root user to match app configuration');
      await this.repo.updateEmail(root.id, root.email);
    }
  }
}
