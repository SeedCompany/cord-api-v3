import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core';
import { BaseNode } from '~/core/database/results';
import {
  Calculated,
  ID,
  IntersectionType,
  Resource,
  ResourceRelationsShape,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredEnum,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { ScopedRole } from '../../authorization';
import { ChangesetAware } from '../../changeset/dto';
import { DefinedFile } from '../../file/dto';
import { Organization } from '../../organization/dto';
import { SecuredPartnerTypes } from '../../partner/dto/partner-type.enum';
import { IProject } from '../../project/dto';
import { FinancialReportingType } from './financial-reporting-type';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';

@ObjectType({
  description: SecuredEnum.descriptionFor('a partnership agreement status'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredEnum(
  PartnershipAgreementStatus,
) {}

@ObjectType({
  description: SecuredEnum.descriptionFor('partnership funding type'),
})
export abstract class SecuredFinancialReportingType extends SecuredEnum(
  FinancialReportingType,
  { nullable: true },
) {}

@RegisterResource()
@ObjectType({
  implements: [Resource, ChangesetAware],
})
export class Partnership extends IntersectionType(ChangesetAware, Resource) {
  static readonly Props = keysOf<Partnership>();
  static readonly SecuredProps = keysOf<SecuredProps<Partnership>>();
  static readonly Relations = {
    // why is this here? We have a relation to partner, not org...
    organization: Organization,
  } satisfies ResourceRelationsShape;
  static readonly Parent = import('../../project/dto').then((m) => m.IProject);

  readonly project: ID;

  @Field(() => IProject)
  declare readonly parent: BaseNode;

  @Field()
  readonly agreementStatus: SecuredPartnershipAgreementStatus;

  readonly mou: DefinedFile;

  @Field()
  readonly mouStatus: SecuredPartnershipAgreementStatus;

  @Calculated()
  @Field()
  readonly mouStart: SecuredDateNullable;

  @Calculated()
  @Field()
  readonly mouEnd: SecuredDateNullable;

  @Field()
  readonly mouStartOverride: SecuredDateNullable;

  @Field()
  readonly mouEndOverride: SecuredDateNullable;

  readonly agreement: DefinedFile;

  readonly partner: Secured<ID>;
  readonly organization: ID;

  @Field()
  readonly types: SecuredPartnerTypes;

  @Field()
  readonly financialReportingType: SecuredFinancialReportingType;

  @Field()
  readonly primary: SecuredBoolean;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  declare readonly scope: ScopedRole[];
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Partnership: typeof Partnership;
  }
}
