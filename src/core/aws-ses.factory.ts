import { FactoryProvider } from '@nestjs/common/interfaces';
import { SES } from 'aws-sdk';
import { ConfigService } from '../core';

export const AwsSESFactory: FactoryProvider<SES> = {
  provide: SES,
  useFactory: (config: ConfigService) => {
    return new SES({
      correctClockSkew: true,
      region: config.awsRegion,
    });
  },
  inject: [ConfigService],
};
