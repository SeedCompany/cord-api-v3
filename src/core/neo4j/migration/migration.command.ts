import { Command } from 'clipanion';
import { InjectableCommand } from '~/core/cli';
import { MigrationRunner } from './migration-runner.service';

@InjectableCommand()
export class DatabaseMigrationCommand extends Command {
  static paths = [['db', 'migrate']];
  static usage = Command.Usage({
    description:
      'Run database migrations needed to sync schema to current version',
  });
  constructor(private readonly runner: MigrationRunner) {
    super();
  }
  async execute() {
    await this.runner.syncUp();
  }
}
