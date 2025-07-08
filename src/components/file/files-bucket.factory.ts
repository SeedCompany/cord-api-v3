import { S3 } from '@aws-sdk/client-s3';
import { type FactoryProvider } from '@nestjs/common';
import { asNonEmptyArray } from '@seedcompany/common';
import { resolve } from 'path';
import { map } from 'rxjs/operators';
import { withAddedPath } from '~/common/url.util';
import { ConfigService } from '~/core';
import {
  CompositeBucket,
  FileBucket,
  FilesystemBucket,
  MemoryBucket,
  S3Bucket,
} from './bucket';
import { type ParsedBucketUri } from './bucket/parse-uri';
import { ReadonlyBucket } from './bucket/readonly-bucket';
import { LocalBucketController } from './local-bucket.controller';

type FileFactory = (uri: ParsedBucketUri) => FileBucket;

export const FilesBucketFactory: FactoryProvider = {
  provide: FileBucket,
  useFactory: (s3: S3, config: ConfigService) => {
    const { sources } = config.files;

    const baseUrl = config.hostUrl$.pipe(
      map((hostUrl) => withAddedPath(hostUrl, LocalBucketController.path)),
    );

    const files: FileFactory = ({ path }) =>
      new FilesystemBucket({
        rootDirectory: resolve(path),
        baseUrl,
      });
    const factories = {
      s3: ({ path }) => {
        const [bucket, ...prefix] = path.split('/');
        return new S3Bucket(s3, bucket!, prefix.join('/'));
      },
      '': files,
      file: files,
      files: files,
      filesystem: files,
      memory: () => new MemoryBucket({ baseUrl }),
    } satisfies Record<string, FileFactory>;

    const builtList = sources.flatMap((uri) => {
      const type = uri.type as keyof typeof factories;
      if (!(type in factories)) {
        return [];
      }
      const bucket = factories[type](uri);
      return uri.readonly ? new ReadonlyBucket(bucket) : bucket;
    });
    const built = asNonEmptyArray(builtList);
    if (!built) {
      return factories.memory();
    }
    if (built.length === 1) {
      return built[0];
    }
    return new CompositeBucket(built);
  },
  inject: [S3, ConfigService],
};
