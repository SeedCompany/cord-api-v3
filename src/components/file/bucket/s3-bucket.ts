import {
  GetObjectCommand,
  GetObjectOutput,
  HeadObjectOutput,
  PutObjectCommand,
  S3,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SdkError } from '@aws-sdk/types';
import { NotFoundException } from '../../../common';
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

  protected async getSignedUrl(
    operation: 'putObject' | 'getObject',
    key: string
  ) {
    const input = {
      Bucket: this.bucket,
      Key: key,
    };
    const command =
      operation === 'putObject'
        ? new PutObjectCommand(input)
        : new GetObjectCommand(input);
    return await getSignedUrl(this.s3, command, {
      expiresIn: this.signedUrlExpires.as('seconds'),
    });
  }

  async getObject(key: string): Promise<GetObjectOutput> {
    return await this.s3
      .getObject({
        Bucket: this.bucket,
        Key: key,
      })
      .catch(handleNotFound);
  }

  async headObject(key: string): Promise<HeadObjectOutput> {
    return await this.s3
      .headObject({
        Bucket: this.bucket,
        Key: key,
      })
      .catch(handleNotFound);
  }

  async copyObject(oldKey: string, newKey: string) {
    await this.s3
      .copyObject({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${oldKey}`,
        Key: newKey,
      })
      .catch(handleNotFound);
  }

  async deleteObject(key: string) {
    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: key,
      })
      .catch(handleNotFound);
  }
}

const handleNotFound = (e: SdkError) => {
  if (e.name === 'NoSuchKey') {
    throw new NotFoundException('Could not find file contents', e);
  }
  throw e;
};
