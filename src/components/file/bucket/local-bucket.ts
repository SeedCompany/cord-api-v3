import {
  GetObjectCommand as GetObject,
  PutObjectCommand as PutObject,
} from '@aws-sdk/client-s3';
import { Command } from '@aws-sdk/smithy-client';
import { Type } from '@nestjs/common';
import { pickBy } from 'lodash';
import { DateTime, Duration } from 'luxon';
import { assert } from 'ts-essentials';
import { InputException } from '~/common';
import { FileBucket, GetObjectOutput, SignedOp } from './file-bucket';

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
export abstract class LocalBucket extends FileBucket {
  private readonly baseUrl: URL;

  constructor(options: LocalBucketOptions) {
    super();
    this.baseUrl = options.baseUrl;
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
    const url = new URL(this.baseUrl);
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
    let raw;
    try {
      raw = new URL(url).searchParams.get('signed');
    } catch (e) {
      raw = url;
    }
    assert(typeof raw === 'string');
    let parsed;
    try {
      parsed = JSON.parse(raw) as SignedOp<TCommandInput> & {
        operation: string;
        Key: string;
      };
      assert(parsed.operation === operation.constructor.name);
      assert(typeof parsed.Key === 'string');
      assert(typeof parsed.signing.expiresIn === 'number');
    } catch (e) {
      throw new InputException(e);
    }
    if (DateTime.local() > DateTime.fromMillis(parsed.signing.expiresIn)) {
      throw new InputException('url expired');
    }
    return parsed;
  }
}
