import type {
  GetObjectOutput as AwsGetObjectOutput,
  PutObjectCommandInput as AwsPutObjectCommandInput,
  HeadObjectOutput,
} from '@aws-sdk/client-s3';
import { type RequestPresigningArguments } from '@aws-sdk/types';
import { type Type } from '@nestjs/common';
import { type MaybeAsync } from '@seedcompany/common';
import { type Command } from '@smithy/smithy-client';
import { type NodeJsRuntimeStreamingBlobPayloadInputTypes } from '@smithy/types/dist-types/streaming-payload/streaming-blob-payload-input-types';
import { type Readable } from 'stream';
import type { Except, LiteralUnion, Merge, SetNonNullable, SetRequired } from 'type-fest';
import { type DurationIn, InputException, type InputExceptionArgs } from '~/common';

// Limit body to only `Readable` which is always the case for Nodejs execution.
export type GetObjectOutput = Merge<AwsGetObjectOutput, { Body: Readable }>;

export type PutObjectInput = Merge<
  SetNonNullable<SetRequired<Except<AwsPutObjectCommandInput, 'Bucket'>, 'ContentType'>, 'Key'>,
  {
    Body: NodeJsRuntimeStreamingBlobPayloadInputTypes;
  }
>;

export type SignedOp<T extends object> = Omit<T, 'Bucket'> & {
  Key: string;
  signing: Merge<RequestPresigningArguments, { expiresIn: DurationIn }>;
};

/**
 * Base interface for a bucket of files
 */
export abstract class FileBucket {
  get isReadonly() {
    return false;
  }

  abstract getSignedUrl<TCommandInput extends object>(
    operation: Type<Command<TCommandInput, any, any>>,
    input: SignedOp<TCommandInput>,
  ): Promise<string>;
  abstract parseSignedUrl(url: URL): MaybeAsync<{
    Key: string;
    operation: LiteralUnion<'PutObject' | 'GetObject', string>;
  }>;

  abstract getObject(key: string): Promise<GetObjectOutput>;
  abstract headObject(key: string): Promise<HeadObjectOutput>;
  abstract putObject(input: PutObjectInput): Promise<void>;
  abstract copyObject(oldKey: string, newKey: string): Promise<void>;
  abstract deleteObject(key: string): Promise<void>;
  async moveObject(oldKey: string, newKey: string) {
    await this.copyObject(oldKey, newKey);
    await this.deleteObject(oldKey);
  }
}

export class InvalidSignedUrlException extends InputException {
  constructor(...args: InputExceptionArgs) {
    super(...InputException.parseArgs('Invalid signed URL', args));
  }
}
