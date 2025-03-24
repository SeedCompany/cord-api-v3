import { Command, Option } from 'clipanion';
import { $, execa } from 'execa';
import { realpath } from 'node:fs/promises';
import { tmpdir as getTempDir } from 'node:os';
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

    // Avoid Gel's nodejs cli proxy.
    // Which tries to transparently download/manage the CLI exe.
    // It is unnecessary work, and I'm not convinced it works correctly,
    // especially for this use case.
    // It is better to just install & use the system-wide one,
    // which is much faster than starting node, everytime.
    const CLIs = await $`which -a gel`;
    const tempDir = await realpath(getTempDir());
    const foundCli = CLIs.stdout
      .split('\n')
      .find((cli) => !cli.startsWith(tempDir));
    const gel = foundCli ?? 'gel';

    try {
      await execa(gel, this.args, {
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
