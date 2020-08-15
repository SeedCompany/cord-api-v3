import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredDate,
  SecuredEnum,
  SecuredEnumList,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
import { Organization } from '../../organization';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipFundingType } from './partnership-funding-type.enum';
import { PartnershipType } from './partnership-type.enum';

@ObjectType({
  description: SecuredEnum.descriptionFor('a partnership agreement status'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredEnum(
  PartnershipAgreementStatus
) {}

@ObjectType({
  description: SecuredEnumList.descriptionFor('partnership types'),
})
export abstract class SecuredPartnershipTypes extends SecuredEnumList(
  PartnershipType
) {}

@ObjectType({
  description: SecuredEnum.descriptionFor('partnership funding type'),
})
export abstract class SecuredPartnershipFundingType extends SecuredEnum(
  PartnershipFundingType
) {}

@ObjectType({
  implements: [Resource],
})
export class Partnership extends Resource {
  @Field()
  readonly agreementStatus: SecuredPartnershipAgreementStatus;

  readonly mou: DefinedFile;

  @Field()
  readonly mouStatus: SecuredPartnershipAgreementStatus;

  @Field()
  readonly mouStart: SecuredDate;

  @Field()
  readonly mouEnd: SecuredDate;

  @Field()
  readonly mouStartOverride: SecuredDate;

  @Field()
  readonly mouEndOverride: SecuredDate;

  readonly agreement: DefinedFile;

  @Field(() => Organization)
  readonly organization: Organization;

  @Field()
  readonly types: SecuredPartnershipTypes;

  @Field()
  readonly fundingType: SecuredPartnershipFundingType;
}
