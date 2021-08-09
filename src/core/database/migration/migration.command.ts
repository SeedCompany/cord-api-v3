import { Command, Console } from 'nestjs-console';
import { MigrationRunner } from './migration-runner.service';

@Console({
  command: 'db',
})
export class DatabaseMigrationCommand {
  constructor(private readonly runner: MigrationRunner) {}
  @Command({
    command: 'migrate',
    description:
      'Run database migrations needed to sync schema to current version',
  })
  async syncUp() {
    await this.runner.syncUp();
  }
}
