import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type PartnershipAgreementStatus = EnumType<
  typeof PartnershipAgreementStatus
>;
export const PartnershipAgreementStatus = makeEnum({
  name: 'PartnershipAgreementStatus',
  values: ['NotAttached', 'AwaitingSignature', 'Signed'],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a partnership agreement status'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredEnum(
  PartnershipAgreementStatus,
) {}
