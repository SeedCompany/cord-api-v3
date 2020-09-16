import { registerEnumType } from '@nestjs/graphql';

export enum PartnerType {
  Managing = 'Managing',
  Funding = 'Funding',
  Impact = 'Impact',
  Technical = 'Technical',
  Resource = 'Resource',
}

registerEnumType(PartnerType, { name: 'PartnerType' });
