import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  IntersectionType,
  Resource,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredEnum,
  SecuredProps,
  Sensitivity,
} from '../../../common';
import { ChangesetAware } from '../../changeset/dto';
import { DefinedFile } from '../../file/dto';
import { Organization } from '../../organization/dto';
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
  implements: [Resource, ChangesetAware],
})
export class Partnership extends IntersectionType(ChangesetAware, Resource) {
  static readonly Props = keysOf<Partnership>();
  static readonly SecuredProps = keysOf<SecuredProps<Partnership>>();
  static readonly Relations = {
    // why is this here? We have a relation to partner, not org...
    organization: Organization,
  };

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

  readonly partner: Secured<ID>;

  @Field()
  readonly types: SecuredPartnerTypes;

  @Field()
  readonly financialReportingType: SecuredFinancialReportingType;

  @Field()
  readonly primary: SecuredBoolean;

  @Field(() => Sensitivity, {
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;
}
