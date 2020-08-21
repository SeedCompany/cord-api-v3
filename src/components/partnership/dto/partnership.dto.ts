import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredDateNullable,
  SecuredEnum,
  SecuredEnumList,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
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
  PartnershipFundingType,
  { nullable: true }
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
  readonly mouStart: SecuredDateNullable;

  @Field()
  readonly mouEnd: SecuredDateNullable;

  @Field()
  readonly mouStartOverride: SecuredDateNullable;

  @Field()
  readonly mouEndOverride: SecuredDateNullable;

  readonly agreement: DefinedFile;

  readonly organization: string;

  @Field()
  readonly types: SecuredPartnershipTypes;

  @Field()
  readonly fundingType: SecuredPartnershipFundingType;
}
