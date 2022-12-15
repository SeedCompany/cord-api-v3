import { S3 } from '@aws-sdk/client-s3';
import { FactoryProvider } from '@nestjs/common';
import { ConfigService } from '../../core';
import { FileBucket, FilesystemBucket, MemoryBucket, S3Bucket } from './bucket';

export const FilesBucketFactory: FactoryProvider = {
  provide: FileBucket,
  useFactory: (s3: S3, config: ConfigService) => {
    const { bucket, localDirectory, baseUrl, signedUrlExpires } = config.files;
    if (bucket) {
      return new S3Bucket({ s3, bucket, signedUrlExpires });
    }
    if (localDirectory) {
      return new FilesystemBucket({
        rootDirectory: localDirectory,
        baseUrl,
        signedUrlExpires,
      });
    }
    return new MemoryBucket({ baseUrl, signedUrlExpires });
  },
  inject: [S3, ConfigService],
};
