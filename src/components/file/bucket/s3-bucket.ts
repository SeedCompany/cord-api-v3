import {
  GetObjectCommand,
  GetObjectCommandInput,
  NoSuchKey,
  PutObjectCommand,
  PutObjectCommandInput,
  S3,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
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
    key: string,
    options?: GetObjectCommandInput | PutObjectCommandInput
  ) {
    const input = {
      ...options,
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

  async getObject(key: string) {
    const file = await this.s3
      .getObject({
        Bucket: this.bucket,
        Key: key,
      })
      .catch(handleNotFound);
    return {
      ...file,
      Body: file.Body as Readable,
    };
  }

  async headObject(key: string) {
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

const handleNotFound = (e: Error) => {
  if (e instanceof NoSuchKey) {
    throw new NotFoundException('Could not find file contents', e);
  }
  throw e;
};
