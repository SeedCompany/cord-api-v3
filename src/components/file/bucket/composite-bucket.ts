import { HeadObjectOutput } from '@aws-sdk/client-s3';
import { Type } from '@nestjs/common';
import { Command } from '@smithy/smithy-client';
import { NotFoundException } from '~/common';
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
    let source;
    try {
      [source] = await this.selectSource(input.Key);
    } catch {
      // If no source has the file, use the first one. It's probably an upload command.
      source = this.sources[0];
    }
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
      throw new AggregateError(
        errors.map((error) => error.reason),
        'Failed to apply some S3 actions',
      );
    }
  }

  private async selectSource(key: string) {
    try {
      const [success] = await this.selectSources(key);
      return success[0];
    } catch (e) {
      if (
        e instanceof AggregateError &&
        e.errors.every((e) => e instanceof NotFoundException)
      ) {
        throw e.errors[0];
      }
      throw e;
    }
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
      throw new AggregateError(errors, 'Key does not exist in any source');
    }
    return [success, errors] as const;
  }
}
