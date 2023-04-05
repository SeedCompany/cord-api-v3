import { HeadObjectOutput } from '@aws-sdk/client-s3';
import { Command } from '@aws-sdk/smithy-client';
import { Type } from '@nestjs/common';
import { FileBucket, GetObjectOutput, SignedOp } from './file-bucket';

/**
 * A bucket that is composed of multiple other sources.
 *
 * For read operations, the first source that has the file is used.
 * If all fail, an error is thrown.
 *
 * For write operations, all writeable sources containing the file are used.
 * If any fail, an error is thrown.
 */
export class CompositeBucket extends FileBucket {
  constructor(private readonly sources: readonly FileBucket[]) {
    super();
  }

  get isReadonly() {
    return this.sources.every((src) => src.isReadonly);
  }

  async getSignedUrl<TCommandInput extends object>(
    operation: Type<Command<TCommandInput, any, any>>,
    input: SignedOp<TCommandInput>,
  ): Promise<string> {
    const [source] = await this.selectSource(input.Key);
    return await source.getSignedUrl(operation, input);
  }

  async getObject(key: string): Promise<GetObjectOutput> {
    const [source] = await this.selectSource(key);
    return await source.getObject(key);
  }

  async headObject(key: string): Promise<HeadObjectOutput> {
    const [_, output] = await this.selectSource(key);
    return output;
  }

  async copyObject(oldKey: string, newKey: string): Promise<void> {
    const [existing] = await this.selectSources(oldKey, this.writableSources);
    await this.doAndThrowAllErrors(
      existing.map(([bucket]) => bucket.copyObject(oldKey, newKey)),
    );
  }

  async deleteObject(key: string): Promise<void> {
    const [existing] = await this.selectSources(key, this.writableSources);
    await this.doAndThrowAllErrors(
      existing.map(([bucket]) => bucket.deleteObject(key)),
    );
  }

  private get writableSources() {
    return this.sources.flatMap((source) => (source.isReadonly ? [] : source));
  }

  private async doAndThrowAllErrors(actions: Array<Promise<void>>) {
    const results = await Promise.allSettled(actions);
    const errors = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (errors.length > 0) {
      throw new AggregateError(errors.map((error) => error.reason));
    }
  }

  private async selectSource(key: string) {
    const [success] = await this.selectSources(key);
    return success[0];
  }

  private async selectSources(key: string, sources?: typeof this.sources) {
    const results = await Promise.allSettled(
      (sources ?? this.sources).map(
        async (source) => [source, await source.headObject(key)] as const,
      ),
    );
    const success = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const errors = results.flatMap((result) =>
      result.status === 'rejected' ? result.reason : [],
    );
    if (success.length === 0) {
      throw new AggregateError(errors);
    }
    return [success, errors] as const;
  }
}
