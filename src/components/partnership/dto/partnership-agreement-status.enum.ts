import { registerEnumType } from '@nestjs/graphql';

export enum PartnershipAgreementStatus {
  NotAttached = 'NotAttached',
  AwaitingSignature = 'AwaitingSignature',
  Signed = 'Signed',
}

registerEnumType(PartnershipAgreementStatus, {
  name: 'PartnershipAgreementStatus',
});
