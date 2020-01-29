import { S3 } from 'aws-sdk';
import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { Duration } from 'luxon';

export interface BucketOptions {
  signedUrlExpiration?: Duration;
}

export class S3Bucket {
  private readonly signedUrlExpires: Duration;

  constructor(
    private readonly s3: S3,
    readonly bucket: string,
    options: BucketOptions = {},
  ) {
    this.signedUrlExpires =
      options.signedUrlExpiration ?? Duration.fromObject({ minutes: 15 });
  }

  async getSignedUrlForPutObject(key: string): Promise<string> {
    return this.getSignedUrl('putObject', key);
  }

  async getSignedUrlForGetObject(key: string): Promise<string> {
    return this.getSignedUrl('getObject', key);
  }

  private getSignedUrl(operation: string, key: string) {
    return this.s3.getSignedUrlPromise(operation, {
      Bucket: this.bucket,
      Key: key,
      Expires: this.signedUrlExpires.as('seconds'),
    });
  }

  async getObject(key: string): Promise<GetObjectOutput> {
    return this.s3
      .getObject({
        Bucket: this.bucket,
        Key: key,
      })
      .promise();
  }

  async moveObject(oldKey: string, newKey: string) {
    await this.copyObject(oldKey, newKey);
    await this.deleteObject(oldKey);
  }

  async copyObject(oldKey: string, newKey: string) {
    await this.s3
      .copyObject({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${oldKey}`,
        Key: newKey,
      })
      .promise();
  }

  async deleteObject(key: string) {
    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: key,
      })
      .promise();
  }
}
