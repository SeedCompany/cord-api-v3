import { FactoryProvider } from '@nestjs/common/interfaces';
import { S3 } from 'aws-sdk';

export const AwsS3Factory: FactoryProvider<S3> = {
  provide: S3,
  useFactory: () => {
    return new S3({
      signatureVersion: 'v4',
    });
  },
};
