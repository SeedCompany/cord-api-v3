import { GetObjectOutput, HeadObjectOutput } from 'aws-sdk/clients/s3';
import { Duration } from 'luxon';

export interface BucketOptions {
  signedUrlExpires?: Duration;
}

/**
 * Base interface for a bucket of files
 */
export abstract class FileBucket {
  protected readonly signedUrlExpires: Duration;

  constructor(options: BucketOptions = {}) {
    this.signedUrlExpires =
      options.signedUrlExpires ?? Duration.fromObject({ minutes: 15 });
  }

  getSignedUrlForPutObject(key: string) {
    return this.getSignedUrl('putObject', key);
  }
  getSignedUrlForGetObject(key: string) {
    return this.getSignedUrl('getObject', key);
  }
  protected abstract getSignedUrl(
    operation: 'putObject' | 'getObject',
    key: string
  ): Promise<string>;
  abstract getObject(key: string): Promise<GetObjectOutput>;
  abstract headObject(key: string): Promise<HeadObjectOutput>;
  abstract copyObject(oldKey: string, newKey: string): Promise<void>;
  abstract deleteObject(key: string): Promise<void>;
  async moveObject(oldKey: string, newKey: string) {
    await this.copyObject(oldKey, newKey);
    await this.deleteObject(oldKey);
  }
}
