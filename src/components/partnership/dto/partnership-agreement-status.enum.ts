import { registerEnumType } from 'type-graphql';

export enum PartnershipAgreementStatus {
  NonAttached = 'NonAttached',
  AwaitingSignature = 'AwaitingSignature',
  Signed = 'Signed',
}

registerEnumType(PartnershipAgreementStatus, {
  name: 'PartnershipAgreementStatus',
});
