import { OnModuleInit } from '@nestjs/common';
import { command } from 'execa';
import { promises as fs } from 'fs';
import * as pkgUp from 'pkg-up';
import { PackageJson } from 'type-fest';
import { ConfigService } from './config/config.service';
import { ILogger, Logger } from './logger';

export class VersionService implements OnModuleInit {
  private setVersion: (v: Version) => void;
  readonly version = new Promise<Version>((res) => {
    this.setVersion = res;
  });

  constructor(
    private readonly config: ConfigService,
    @Logger('version') private readonly logger: ILogger
  ) {}

  async onModuleInit() {
    const version = await this.determine();
    this.setVersion(version);
    this.logger.debug(`${version}`);
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
    try {
      const res = await command('git symbolic-ref -q --short HEAD');
      return res.stdout;
    } catch (e) {
      return undefined;
    }
  }

  private async gitHash() {
    try {
      const res = await command('git rev-parse -q --short HEAD');
      return res.stdout;
    } catch (e) {
      return undefined;
    }
  }

  private async fromPackageJson() {
    const packageJson = await pkgUp();
    if (!packageJson) {
      return undefined;
    }
    try {
      const str = await fs.readFile(packageJson, { encoding: 'utf8' });
      const json: PackageJson = JSON.parse(str);
      return json.version;
    } catch (e) {
      return undefined;
    }
  }
}

export class Version {
  constructor(
    readonly hash?: string,
    readonly branch?: string,
    readonly packageJson?: string
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
