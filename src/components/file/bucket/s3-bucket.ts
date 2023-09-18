import { NoSuchKey, S3 } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Type } from '@nestjs/common';
import { Command } from '@smithy/smithy-client';
import { Duration } from 'luxon';
import { join } from 'path/posix';
import { Readable } from 'stream';
import { NotFoundException } from '~/common';
import { FileBucket, PutObjectInput, SignedOp } from './file-bucket';

/**
 * A bucket that actually connects to S3.
 */
export class S3Bucket extends FileBucket {
  constructor(
    private readonly s3: S3,
    private readonly bucket: string,
    private readonly prefix = '',
  ) {
    super();
  }

  async getSignedUrl<TCommandInput extends object>(
    operation: Type<Command<TCommandInput, any, any>>,
    input: SignedOp<TCommandInput>,
  ) {
    const { signing, ...rest } = input;
    const command = new operation({
      ...rest,
      Key: this.fullKey(rest.Key),
      Bucket: this.bucket,
    });
    return await getSignedUrl(this.s3, command, {
      ...signing,
      expiresIn: Duration.from(signing.expiresIn).as('seconds'),
    });
  }

  async getObject(key: string) {
    const file = await this.s3
      .getObject({
        Bucket: this.bucket,
        Key: this.fullKey(key),
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
        Key: this.fullKey(key),
      })
      .catch(handleNotFound);
  }

  async putObject(input: PutObjectInput) {
    await this.s3.putObject({
      ...input,
      Key: this.fullKey(input.Key),
      Bucket: this.bucket,
    });
  }

  async copyObject(oldKey: string, newKey: string) {
    await this.s3
      .copyObject({
        Bucket: this.bucket,
        CopySource: join(this.bucket, this.fullKey(oldKey)),
        Key: this.fullKey(newKey),
      })
      .catch(handleNotFound);
  }

  async deleteObject(key: string) {
    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: this.fullKey(key),
      })
      .catch(handleNotFound);
  }

  private fullKey(key: string) {
    return join(this.prefix, key);
  }
}

const handleNotFound = (e: Error) => {
  if (e instanceof NoSuchKey) {
    throw new NotFoundException('Could not find file contents', e);
  }
  throw e;
};
