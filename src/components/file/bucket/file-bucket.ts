import {
  GetObjectOutput as AwsGetObjectOutput,
  HeadObjectOutput,
} from '@aws-sdk/client-s3';
import { RequestPresigningArguments } from '@aws-sdk/types';
import { Type } from '@nestjs/common';
import { Command } from '@smithy/smithy-client';
import { Readable } from 'stream';
import { Merge } from 'type-fest';
import { DurationIn } from '~/common';

// Limit body to only `Readable` which is always the case for Nodejs execution.
export type GetObjectOutput = Merge<AwsGetObjectOutput, { Body: Readable }>;

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

  abstract getObject(key: string): Promise<GetObjectOutput>;
  abstract headObject(key: string): Promise<HeadObjectOutput>;
  abstract copyObject(oldKey: string, newKey: string): Promise<void>;
  abstract deleteObject(key: string): Promise<void>;
  async moveObject(oldKey: string, newKey: string) {
    await this.copyObject(oldKey, newKey);
    await this.deleteObject(oldKey);
  }
}
