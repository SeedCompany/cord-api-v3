import { HeadObjectOutput } from 'aws-sdk/clients/s3';
import { NotFoundException } from '../../../common';
import { FakeAwsFile, LocalBucket } from './local-bucket';

/**
 * A bucket that uses the current memory to store everything
 */
export class MemoryBucket extends LocalBucket {
  private readonly files = new Map<string, FakeAwsFile>();

  async clear() {
    this.files.clear();
  }

  protected async saveFile(key: string, file: FakeAwsFile): Promise<void> {
    this.files.set(key, file);
  }

  async headObject(key: string): Promise<HeadObjectOutput> {
    const { Body, ...rest } = await this.getObject(key);
    return rest;
  }

  async getObject(key: string): Promise<FakeAwsFile> {
    const file = this.files.get(key);
    if (!file) {
      throw new NotFoundException();
    }
    return file;
  }

  async copyObject(oldKey: string, newKey: string): Promise<void> {
    this.files.set(newKey, await this.getObject(oldKey));
  }

  async deleteObject(key: string): Promise<void> {
    this.files.delete(key);
  }
}
