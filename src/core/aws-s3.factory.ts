import { FactoryProvider } from '@nestjs/common/interfaces';
import { ConfigService } from './config/config.service';
import { config as awsConfig, S3 } from 'aws-sdk';

export const AwsS3Factory: FactoryProvider<S3> = {
  provide: S3,
  useFactory: (config: ConfigService) => {
    const { accessKeyId, secretAccessKey, region } = config.aws;
    awsConfig.update({
      accessKeyId,
      region,
      secretAccessKey,
    });
    return new S3({
      signatureVersion: 'v4',
    });
  },
  inject: [ConfigService],
};
