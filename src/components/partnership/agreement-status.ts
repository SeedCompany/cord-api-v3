import { registerEnumType } from 'type-graphql';

export enum PartnershipAgreementStatus {
  NotAttached = 'na',
  AwaitingSignature = 'as',
  Signed = 's',
}

registerEnumType(PartnershipAgreementStatus, {
  name: 'PartnershipAgreementStatus',
});
