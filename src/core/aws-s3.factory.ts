import { S3 } from '@aws-sdk/client-s3';
import { FactoryProvider } from '@nestjs/common';

export const AwsS3Factory: FactoryProvider<S3> = {
  provide: S3,
  useFactory: () => {
    return new S3({});
  },
};
