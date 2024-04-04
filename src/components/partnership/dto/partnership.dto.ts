import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Calculated,
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
} from '~/common';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { ChangesetAware } from '../../changeset/dto';
import { Organization } from '../../organization/dto';
import { SecuredPartnerTypes } from '../../partner/dto';
import { IProject } from '../../project/dto';
import { FinancialReportingType } from './financial-reporting-type.enum';
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

@RegisterResource({ db: e.Partnership })
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

  readonly project: LinkTo<'Project'>;

  @Field(() => IProject)
  declare readonly parent: BaseNode;

  @Field()
  readonly agreementStatus: SecuredPartnershipAgreementStatus;

  readonly mou: Secured<LinkTo<'File'> | null>;

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

  readonly agreement: Secured<LinkTo<'File'> | null>;

  readonly partner: Secured<LinkTo<'Partner'>>;
  readonly organization: LinkTo<'Organization'>;

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
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Partnership: typeof Partnership;
  }
  interface ResourceDBMap {
    Partnership: typeof e.default.Partnership;
  }
}
