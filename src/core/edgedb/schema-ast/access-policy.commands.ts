import { Command, Option } from 'clipanion';
import { execa } from 'execa';
import { InjectableCommand } from '~/core';
import { EdgeDBAccessPolicyInjector } from './access-policy.injector';

@InjectableCommand()
abstract class ApCommand extends Command {
  constructor(protected readonly injector: EdgeDBAccessPolicyInjector) {
    super();
  }
}

export class EdgeDBAccessPolicyWrapMigrateCommand extends ApCommand {
  static paths = [['edgedb', 'migration']];
  static usage = Command.Usage({
    category: 'EdgeDB',
    description:
      'Wrap an EdgeDB migration command with access policies injected',
  });
  args = Option.Proxy();
  async execute() {
    const files = await this.injector.discoverFiles();
    await this.injector.injectAll(files);
    try {
      await execa('edgedb', ['migration', ...this.args], {
        stdio: 'inherit',
      });
    } catch {
      return 1;
    } finally {
      await this.injector.ejectAll(files);
    }
    return;
  }
}

export class EdgeDBAccessPolicyInjectCommand extends ApCommand {
  static paths = [['edgedb', 'ap', 'inject']];
  static usage = Command.Usage({
    category: 'EdgeDB',
    description:
      'Inject generated access policies from app policies into schema files',
  });
  async execute() {
    await this.injector.inject();
  }
}

export class EdgeDBAccessPolicyEjectCommand extends ApCommand {
  static paths = [['edgedb', 'ap', 'eject']];
  static usage = Command.Usage({
    category: 'EdgeDB',
    description: 'Eject generated access policies from schema files',
  });
  async execute() {
    await this.injector.eject();
  }
}
