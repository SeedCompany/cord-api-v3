import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredDateNullable,
  SecuredEnum,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
import { SecuredPartnerTypes } from '../../partner/dto/partner-type.enum';
import { FinancialReportingType } from './financial-reporting-type';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';

@ObjectType({
  description: SecuredEnum.descriptionFor('a partnership agreement status'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredEnum(
  PartnershipAgreementStatus
) {}

@ObjectType({
  description: SecuredEnum.descriptionFor('partnership funding type'),
})
export abstract class SecuredFinancialReportingType extends SecuredEnum(
  FinancialReportingType,
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

  readonly partner: Secured<string>;

  @Field()
  readonly types: SecuredPartnerTypes;

  @Field()
  readonly financialReportingType: SecuredFinancialReportingType;
}
