import {
  GetObjectCommand as GetObject,
  PutObjectCommand as PutObject,
} from '@aws-sdk/client-s3';
import { Type } from '@nestjs/common';
import { bufferFromStream } from '@seedcompany/common';
import { Command } from '@smithy/smithy-client';
import { pickBy } from 'lodash';
import { DateTime, Duration } from 'luxon';
import { URL } from 'node:url';
import { Readable } from 'stream';
import { assert } from 'ts-essentials';
import {
  FileBucket,
  GetObjectOutput,
  InvalidSignedUrlException,
  PutObjectInput,
  SignedOp,
} from './file-bucket';

export interface LocalBucketOptions {
  baseUrl: URL;
}

export type FakeAwsFile = Required<Pick<GetObjectOutput, 'ContentType'>> &
  Pick<
    GetObjectOutput,
    'ContentLength' | 'ContentLanguage' | 'ContentEncoding' | 'LastModified'
  > & { Body: Buffer };

/**
 * Common functionality for "local" (non-s3) buckets
 */
export abstract class LocalBucket<
  Options extends LocalBucketOptions = LocalBucketOptions,
> extends FileBucket {
  constructor(protected options: Options) {
    super();
  }

  async download(signed: string): Promise<GetObjectOutput> {
    const parsed = this.validateSignedUrl(GetObject, signed);
    return {
      ...(await this.getObject(parsed.Key)),
      ...pickBy(
        {
          ContentType: parsed.ResponseContentType,
          ContentDisposition: parsed.ResponseContentDisposition,
          CacheControl: parsed.ResponseCacheControl,
          ContentEncoding: parsed.ResponseContentEncoding,
          ContentLanguage: parsed.ResponseContentLanguage,
          Expires: parsed.ResponseExpires,
        },
        (val) => val != null,
      ),
    };
  }

  async upload(signed: string, file: FakeAwsFile) {
    const parsed = this.validateSignedUrl(PutObject, signed);
    await this.saveFile(parsed.Key, {
      ContentLength: file.Body.byteLength,
      LastModified: new Date(),
      ...file,
    });
  }

  abstract clear(): Promise<void>;

  protected abstract saveFile(key: string, file: FakeAwsFile): Promise<void>;

  async putObject(input: PutObjectInput) {
    const buffer =
      input.Body instanceof Readable
        ? await bufferFromStream(input.Body)
        : Buffer.from(input.Body);
    await this.saveFile(input.Key, {
      LastModified: new Date(),
      ...input,
      Body: buffer,
      ContentLength: buffer.byteLength,
    });
  }

  async getSignedUrl<TCommandInput extends object>(
    operation: Type<Command<TCommandInput, any, any>>,
    input: SignedOp<TCommandInput>,
  ) {
    const signed = JSON.stringify({
      operation: operation.constructor.name,
      ...input,
      signing: {
        ...input.signing,
        expiresIn: DateTime.local()
          .plus(Duration.from(input.signing.expiresIn))
          .toMillis(),
      },
    });
    const url = new URL(this.options.baseUrl.toString());
    url.searchParams.set('signed', signed);
    return url.toString();
  }

  /**
   * parses & validates the signed url or just the json query param
   */
  protected validateSignedUrl<TCommandInput extends object>(
    operation: Type<Command<TCommandInput, any, any>>,
    url: string,
  ): SignedOp<TCommandInput> & { Key: string } {
    let u: URL;
    try {
      u = new URL(url);
    } catch (e) {
      u = new URL('http://localhost');
      u.searchParams.set('signed', url);
    }
    try {
      const parsed = this.parseSignedUrl(u) as SignedOp<TCommandInput> & {
        operation: string;
      };
      assert(parsed.operation === operation.constructor.name);
      return parsed;
    } catch (e) {
      throw new InvalidSignedUrlException(e);
    }
  }

  parseSignedUrl(url: URL) {
    const raw = url.searchParams.get('signed');
    let parsed;
    try {
      parsed = JSON.parse(raw || '') as SignedOp<{ operation: string }>;
      assert(typeof parsed.operation === 'string');
      assert(typeof parsed.Key === 'string');
      assert(typeof parsed.signing.expiresIn === 'number');
    } catch (e) {
      throw new InvalidSignedUrlException(e);
    }
    if (DateTime.local() > DateTime.fromMillis(parsed.signing.expiresIn)) {
      throw new InvalidSignedUrlException('URL expired');
    }
    return parsed;
  }
}
