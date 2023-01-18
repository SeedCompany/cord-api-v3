import {
  GetObjectCommandInput,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { pickBy } from 'lodash';
import { DateTime } from 'luxon';
import { assert } from 'ts-essentials';
import { Except } from 'type-fest';
import { InputException } from '~/common';
import { BucketOptions, FileBucket, GetObjectOutput } from './file-bucket';

export interface LocalBucketOptions extends BucketOptions {
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
    super(options);
    this.baseUrl = options.baseUrl;
  }

  async download(signed: string): Promise<GetObjectOutput> {
    const parsed: GetObjectCommandInput = this.validateSignedUrl(
      'getObject',
      signed
    );
    return {
      ...(await this.getObject(parsed.Key!)),
      ...pickBy(
        {
          ContentType: parsed.ResponseContentType,
          ContentDisposition: parsed.ResponseContentDisposition,
          CacheControl: parsed.ResponseCacheControl,
          ContentEncoding: parsed.ResponseContentEncoding,
          ContentLanguage: parsed.ResponseContentLanguage,
          Expires: parsed.ResponseExpires,
        },
        (val) => val != null
      ),
    };
  }

  async upload(signed: string, file: FakeAwsFile) {
    const parsed = this.validateSignedUrl('putObject', signed);
    await this.saveFile(parsed.Key!, {
      ContentLength: file.Body.byteLength,
      LastModified: new Date(),
      ...file,
    });
  }

  abstract clear(): Promise<void>;

  protected abstract saveFile(key: string, file: FakeAwsFile): Promise<void>;

  protected async getSignedUrl(
    operation: string,
    key: string,
    options?: Except<
      GetObjectCommandInput | PutObjectCommandInput,
      'Bucket' | 'Key'
    >
  ) {
    const signed = JSON.stringify({
      operation,
      Key: key,
      expires: DateTime.local().plus(this.signedUrlExpires).toMillis(),
      ...options,
    });
    const url = new URL(this.baseUrl);
    url.searchParams.set('signed', signed);
    return url.toString();
  }

  /**
   * parses & validates the signed url or just the json query param
   */
  protected validateSignedUrl(
    operation: string,
    url: string
  ): GetObjectCommandInput | PutObjectCommandInput {
    let raw;
    try {
      raw = new URL(url).searchParams.get('signed');
    } catch (e) {
      raw = url;
    }
    assert(typeof raw === 'string');
    let parsed;
    try {
      parsed = JSON.parse(raw);
      assert(parsed.operation === operation);
      assert(typeof parsed.Key === 'string');
      assert(typeof parsed.expires === 'number');
    } catch (e) {
      throw new InputException(e);
    }
    if (DateTime.local() > DateTime.fromMillis(parsed.expires)) {
      throw new InputException('url expired');
    }
    return parsed;
  }
}
