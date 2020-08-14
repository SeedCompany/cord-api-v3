import { registerEnumType } from '@nestjs/graphql';

export enum PartnershipFundingType {
  Funded = 'Funded',
  FieldEngaged = 'FieldEngaged',
}

registerEnumType(PartnershipFundingType, { name: 'PartnershipFundingType' });
