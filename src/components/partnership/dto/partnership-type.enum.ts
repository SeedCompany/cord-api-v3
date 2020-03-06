import { registerEnumType } from 'type-graphql';

export enum PartnershipType {
  Managing = 'Managing',
  Funding = 'Funding',
  Impact = 'Impact',
  Technical = 'Technical',
  Resource = 'Resource',
}

registerEnumType(PartnershipType, { name: 'PartnershipType' });
