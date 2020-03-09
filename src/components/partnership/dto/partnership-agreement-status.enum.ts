import { registerEnumType } from 'type-graphql';

export enum PartnershipAgreementStatus {
  NotAttached = 'NotAttached',
  AwaitingSignature = 'AwaitingSignature',
  Signed = 'Signed',
}

registerEnumType(PartnershipAgreementStatus, {
  name: 'PartnershipAgreementStatus',
});
