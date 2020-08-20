import { S3 } from 'aws-sdk';
import { GetObjectOutput, HeadObjectOutput } from 'aws-sdk/clients/s3';
import { BucketOptions, FileBucket } from './file-bucket';

export interface S3BucketOptions extends BucketOptions {
  s3: S3;
  bucket: string;
}

/**
 * A bucket that actually connects to S3.
 */
export class S3Bucket extends FileBucket {
  private readonly s3: S3;
  private readonly bucket: string;
  constructor(options: S3BucketOptions) {
    super(options);
    this.s3 = options.s3;
    this.bucket = options.bucket;
  }

  protected getSignedUrl(operation: string, key: string) {
    return this.s3.getSignedUrlPromise(operation, {
      Bucket: this.bucket,
      Key: key,
      Expires: this.signedUrlExpires.as('seconds'),
    });
  }

  async getObject(key: string): Promise<GetObjectOutput> {
    return await this.s3
      .getObject({
        Bucket: this.bucket,
        Key: key,
      })
      .promise();
  }

  async headObject(key: string): Promise<HeadObjectOutput> {
    return await this.s3
      .headObject({
        Bucket: this.bucket,
        Key: key,
      })
      .promise();
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
