import { NoSuchKey, S3 } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Type } from '@nestjs/common';
import { bufferFromStream } from '@seedcompany/common';
import { Command } from '@smithy/smithy-client';
import got from 'got';
import { Duration } from 'luxon';
import { join } from 'path/posix';
import { Readable } from 'stream';
import { NotFoundException } from '~/common';
import {
  FileBucket,
  InvalidSignedUrlException,
  PutObjectInput,
  SignedOp,
} from './file-bucket';

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

  async parseSignedUrl(url: URL) {
    if (
      !url.hostname.startsWith(this.bucket + '.') ||
      !url.hostname.endsWith('.amazonaws.com')
    ) {
      throw new InvalidSignedUrlException();
    }

    try {
      await got.head(url);
    } catch (e) {
      throw new InvalidSignedUrlException(e);
    }

    const Key = url.pathname.slice(1);
    const operation = url.searchParams.get('x-id')!;
    return { Key, operation };
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
    // S3 needs to know the content length either from body or the header.
    // Since we streams don't have that, and we don't know from file, we need to
    // buffer it. This way we can know the length to send to S3.
    const fixedLengthBody =
      input.Body instanceof Readable
        ? await bufferFromStream(input.Body)
        : input.Body;
    await this.s3.putObject({
      ...input,
      Key: this.fullKey(input.Key),
      Bucket: this.bucket,
      Body: fixedLengthBody,
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
