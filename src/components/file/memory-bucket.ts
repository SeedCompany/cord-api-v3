import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GetObjectOutput, HeadObjectOutput } from 'aws-sdk/clients/s3';
import { assert } from 'ts-essentials';
import { IS3Bucket } from './s3-bucket';

type FakeFile = Required<
  Pick<GetObjectOutput, 'Body' | 'ContentType' | 'ContentLength'>
>;

export class MemoryBucket implements IS3Bucket {
  private readonly files = new Map<string, FakeFile>();

  private get(key: string) {
    const contents = this.files.get(key);
    if (!contents) {
      throw new NotFoundException();
    }
    return contents;
  }

  clear() {
    this.files.clear();
  }

  /**
   * This fakes the actual upload to "S3"
   */
  save(signedUrl: string, file: FakeFile) {
    let parsed;
    try {
      parsed = JSON.parse(signedUrl);
      assert(parsed.operation === 'putObject');
      assert(typeof parsed.key === 'string');
    } catch (e) {
      throw new BadRequestException();
    }
    this.files.set(parsed.key, file);
  }

  async headObject(key: string): Promise<HeadObjectOutput> {
    const { Body, ...rest } = this.get(key);
    return rest;
  }

  async getObject(key: string): Promise<GetObjectOutput> {
    return this.get(key);
  }

  async getSignedUrlForGetObject(key: string): Promise<string> {
    return this.getSignedUrl('getObject', key);
  }

  async getSignedUrlForPutObject(key: string): Promise<string> {
    return this.getSignedUrl('putObject', key);
  }

  async getSignedUrl(operation: string, key: string): Promise<string> {
    return JSON.stringify({ operation, key });
  }

  async copyObject(oldKey: string, newKey: string): Promise<void> {
    this.files.set(newKey, this.get(oldKey));
  }

  async deleteObject(key: string): Promise<void> {
    this.files.delete(key);
  }

  async moveObject(oldKey: string, newKey: string): Promise<void> {
    await this.copyObject(oldKey, newKey);
    await this.deleteObject(oldKey);
  }
}
