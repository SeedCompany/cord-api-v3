import { NoSuchKey, S3 } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Command } from '@aws-sdk/smithy-client';
import { Type } from '@nestjs/common';
import { Duration } from 'luxon';
import { Readable } from 'stream';
import { NotFoundException } from '~/common';
import { FileBucket, SignedOp } from './file-bucket';

/**
 * A bucket that actually connects to S3.
 */
export class S3Bucket extends FileBucket {
  constructor(private readonly s3: S3, private readonly bucket: string) {
    super();
  }

  async getSignedUrl<TCommandInput extends object>(
    operation: Type<Command<TCommandInput, any, any>>,
    input: SignedOp<TCommandInput>,
  ) {
    const { signing, ...rest } = input;
    const command = new operation({
      ...rest,
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
