import { S3 } from '@aws-sdk/client-s3';
import { FactoryProvider } from '@nestjs/common';
import { withAddedPath } from '~/common/url.util';
import { ConfigService } from '../../core';
import { FileBucket, FilesystemBucket, MemoryBucket, S3Bucket } from './bucket';
import { LocalBucketController } from './local-bucket.controller';

export const FilesBucketFactory: FactoryProvider = {
  provide: FileBucket,
  useFactory: (s3: S3, config: ConfigService) => {
    const { bucket, localDirectory } = config.files;
    if (bucket) {
      return new S3Bucket(s3, bucket);
    }

    const baseUrl = withAddedPath(config.hostUrl, LocalBucketController.path);

    if (localDirectory) {
      return new FilesystemBucket({
        rootDirectory: localDirectory,
        baseUrl,
      });
    }
    return new MemoryBucket({ baseUrl });
  },
  inject: [S3, ConfigService],
};
