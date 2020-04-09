import { FactoryProvider } from '@nestjs/common/interfaces';
import { SES } from 'aws-sdk';

export const AwsSESFactory: FactoryProvider<SES> = {
  provide: SES,
  useFactory: () => {
    return new SES({
      correctClockSkew: true,
    });
  },
};
