import { OnModuleInit } from '@nestjs/common';
import { $ } from 'execa';
import { LazyGetter } from 'lazy-get-decorator';
import { readPackageUp } from 'read-package-up';
import { ILogger, Logger } from '../logger';
import { ConfigService } from './config.service';
import { EnvironmentService } from './environment.service';

export class VersionService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly env: EnvironmentService,
    @Logger('version') private readonly logger: ILogger,
  ) {}

  async onModuleInit() {
    const version = await this.version;
    this.logger.debug(version.toString());
  }

  @LazyGetter() get version(): Promise<Version> {
    return this.determine();
  }

  private async determine() {
    if (this.config.jest) {
      // Don't bother calculating for test runs
      return new Version();
    }

    const hash = await this.gitHash();
    const branch = await this.gitBranch();
    const packageJson = await this.fromPackageJson();
    return new Version(hash, branch, packageJson);
  }

  private async gitBranch() {
    const env = this.env.string('GIT_BRANCH').optional();
    if (env) {
      return env;
    }
    try {
      const res = await $`git symbolic-ref -q --short HEAD`;
      return res.stdout;
    } catch (e) {
      return undefined;
    }
  }

  private async gitHash() {
    const env = this.env.string('GIT_HASH').optional();
    if (env) {
      return env;
    }
    try {
      const res = await $`git rev-parse -q --short HEAD`;
      return res.stdout;
    } catch (e) {
      return undefined;
    }
  }

  private async fromPackageJson() {
    const res = await readPackageUp();
    if (!res) {
      return undefined;
    }
    try {
      return res.packageJson.version;
    } catch (e) {
      return undefined;
    }
  }
}

export class Version {
  constructor(
    readonly hash?: string,
    readonly branch?: string,
    readonly packageJson?: string,
  ) {}

  get known() {
    return (
      Boolean(this.branch) || Boolean(this.hash) || Boolean(this.packageJson)
    );
  }

  toString() {
    if (this.branch && this.hash) {
      return `${this.branch} (${this.hash})`;
    }
    if (this.hash) {
      return this.hash;
    }
    if (this.branch) {
      return this.branch;
    }
    if (this.packageJson) {
      return this.packageJson;
    }
    return 'unknown';
  }
}
