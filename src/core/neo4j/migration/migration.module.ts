import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { DatabaseService } from '../database.service';
import { MigrationRunner } from './migration-runner.service';
import { DatabaseMigrationCommand } from './migration.command';
import { MigrationRegistry } from './migration.registry';

@Module({
  providers: [MigrationRunner, MigrationRegistry, DatabaseMigrationCommand],
  exports: [MigrationRegistry],
})
export class MigrationModule implements OnApplicationBootstrap {
  constructor(
    private readonly db: DatabaseService,
    private readonly runner: MigrationRunner,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
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
