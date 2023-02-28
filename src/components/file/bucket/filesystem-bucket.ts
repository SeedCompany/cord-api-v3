import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { Readable } from 'stream';
import { NotFoundException } from '../../../common';
import { FakeAwsFile, LocalBucket, LocalBucketOptions } from './local-bucket';

export interface FilesystemBucketOptions extends LocalBucketOptions {
  rootDirectory: string;
}

/**
 * A bucket that uses the local filesystem
 */
export class FilesystemBucket extends LocalBucket {
  private readonly rootDir: string;

  constructor(options: FilesystemBucketOptions) {
    super(options);
    this.rootDir = resolve(options.rootDirectory);
  }

  protected async saveFile(key: string, file: FakeAwsFile) {
    const { Body, ...info } = file;
    await this.writeFile(key, Body);
    await this.writeFile(`${key}.info`, JSON.stringify(info));
  }

  async clear(): Promise<void> {
    await fs.rmdir(this.rootDir, {
      recursive: true,
    });
  }

  async getObject(key: string) {
    const rest = await this.headObject(key);
    const Body = Readable.from(await this.readFile(key));
    return { Body, ...rest };
  }

  async headObject(key: string) {
    const path = this.getPath(key);
    try {
      await fs.stat(path);
    } catch (e) {
      throw new NotFoundException(e);
    }
    const raw = await this.readFile(key + '.info');
    const info = JSON.parse(raw.toString());
    info.LastModified = new Date(info.LastModified);

    return info;
  }

  async copyObject(oldKey: string, newKey: string) {
    await fs.copyFile(this.getPath(oldKey), this.getPath(newKey));
    await fs.copyFile(
      this.getPath(oldKey) + '.info',
      this.getPath(newKey) + '.info',
    );
  }

  async deleteObject(key: string) {
    await fs.unlink(this.getPath(key));
    await fs.unlink(this.getPath(key) + '.info');
  }

  private async readFile(key: string) {
    return await fs.readFile(this.getPath(key));
  }

  private async writeFile(key: string, data: any) {
    const path = this.getPath(key);
    await fs.mkdir(dirname(path), {
      recursive: true,
    });
    await fs.writeFile(this.getPath(key), data);
  }

  private getPath(key: string) {
    return join(this.rootDir, key);
  }
}
