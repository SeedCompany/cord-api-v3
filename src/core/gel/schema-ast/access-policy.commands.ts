import { Command, Option } from 'clipanion';
import { execa } from 'execa';
import { InjectableCommand } from '~/core';
import { GelAccessPolicyInjector } from './access-policy.injector';

@InjectableCommand()
abstract class ApCommand extends Command {
  constructor(protected readonly injector: GelAccessPolicyInjector) {
    super();
  }
}

export class GelAccessPolicyWrapCommand extends ApCommand {
  static paths = [['gel']];
  static usage = Command.Usage({
    category: 'Gel',
    description: 'Wrap an Gel command with access policies injected',
  });
  args = Option.Proxy();
  async execute() {
    const files = await this.injector.discoverFiles();
    await this.injector.injectAll(files);
    try {
      await execa('gel', this.args, {
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

export class GelAccessPolicyInjectCommand extends ApCommand {
  static paths = [['gel', 'ap', 'inject']];
  static usage = Command.Usage({
    category: 'Gel',
    description:
      'Inject generated access policies from app policies into schema files',
  });
  async execute() {
    await this.injector.inject();
  }
}

export class GelAccessPolicyEjectCommand extends ApCommand {
  static paths = [['gel', 'ap', 'eject']];
  static usage = Command.Usage({
    category: 'Gel',
    description: 'Eject generated access policies from schema files',
  });
  async execute() {
    await this.injector.eject();
  }
}
