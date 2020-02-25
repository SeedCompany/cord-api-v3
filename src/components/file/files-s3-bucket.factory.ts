import { S3 } from 'aws-sdk';
import { ConfigService } from '../../core';
import { S3Bucket } from './s3-bucket';

export const FilesBucketToken = Symbol('FilesBucket');

export const FilesBucketFactory = {
  provide: FilesBucketToken,
  useFactory: (s3: S3, config: ConfigService) => {
    return new S3Bucket(s3, config.files.bucket || '', {});
  },
  inject: [S3, ConfigService],
};
