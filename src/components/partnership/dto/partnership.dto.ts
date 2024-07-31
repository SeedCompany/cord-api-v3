import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Calculated,
  IntersectTypes,
  Resource,
  ResourceRelationsShape,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
  SensitivityField,
  UnsecuredDto,
} from '~/common';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { ChangesetAware } from '../../changeset/dto';
import { Organization } from '../../organization/dto';
import { SecuredPartnerTypes } from '../../partner/dto';
import { IProject } from '../../project/dto';
import { SecuredFinancialReportingType } from './financial-reporting-type.enum';
import { SecuredPartnershipAgreementStatus } from './partnership-agreement-status.enum';

export type PartnershipByProjectAndPartnerInput = UnsecuredDto<
  Pick<Partnership, 'project' | 'partner'>
>;

const Interfaces = IntersectTypes(Resource, ChangesetAware);

@RegisterResource({ db: e.Partnership })
@ObjectType({
  implements: Interfaces.members,
})
export class Partnership extends Interfaces {
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

@ObjectType({
  description: SecuredProperty.descriptionFor('a partnership'),
})
export class SecuredPartnership extends SecuredProperty(Partnership) {}
