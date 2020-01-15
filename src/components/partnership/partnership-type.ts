import { registerEnumType } from 'type-graphql';

export enum PartnershipType {
  Managing = 'm',
  Funding = 'f',
  Impact = 'i',
  Technical = 't',
  Resource = 'r',
}

registerEnumType(PartnershipType, { name: 'PartnershipType' });
