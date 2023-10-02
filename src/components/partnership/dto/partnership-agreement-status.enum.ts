import { EnumType, makeEnum } from '~/common';

export type PartnershipAgreementStatus = EnumType<
  typeof PartnershipAgreementStatus
>;
export const PartnershipAgreementStatus = makeEnum({
  name: 'PartnershipAgreementStatus',
  values: ['NotAttached', 'AwaitingSignature', 'Signed'],
});
