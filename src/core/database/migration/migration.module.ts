import { DiscoveryModule } from '@golevelup/nestjs-discovery';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { DatabaseService } from '../database.service';
import { MigrationDiscovery } from './migration-discovery.service';
import { MigrationRunner } from './migration-runner.service';
import { DatabaseMigrationCommand } from './migration.command';

@Module({
  imports: [DiscoveryModule],
  providers: [MigrationRunner, MigrationDiscovery, DatabaseMigrationCommand],
})
export class MigrationModule implements OnModuleInit {
  constructor(
    private readonly db: DatabaseService,
    private readonly runner: MigrationRunner,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const entryCmd = process.argv.join('');
    if (
      !this.config.dbAutoMigrate ||
      entryCmd.includes('console') ||
      entryCmd.includes('repl')
    ) {
      return;
    }

    void this.db.runOnceUntilCompleteAfterConnecting(async () => {
      await this.runner.syncUp();
    });
  }
}
