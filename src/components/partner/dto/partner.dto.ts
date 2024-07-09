import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  IntersectTypes,
  Resource,
  ResourceRelationsShape,
  Secured,
  SecuredBoolean,
  SecuredDateNullable,
  SecuredProperty,
  SecuredProps,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { SecuredFinancialReportingTypes } from '../../partnership/dto';
import { Pinnable } from '../../pin/dto';
import { Postable } from '../../post/dto';
import { IProject } from '../../project/dto';
import { SecuredPartnerTypes } from './partner-type.enum';

const Interfaces = IntersectTypes(Resource, Pinnable, Postable);

@RegisterResource({ db: e.Partner })
@ObjectType({
  implements: Interfaces.members,
})
export class Partner extends Interfaces {
  static readonly Props = keysOf<Partner>();
  static readonly SecuredProps = keysOf<SecuredProps<Partner>>();
  static readonly Relations = () =>
    ({
      projects: [IProject],
      ...Postable.Relations,
    } satisfies ResourceRelationsShape);

  readonly organization: Secured<LinkTo<'Organization'>>;

  readonly pointOfContact: Secured<LinkTo<'User'> | null>;

  @Field()
  readonly types: SecuredPartnerTypes;

  @Field()
  readonly financialReportingTypes: SecuredFinancialReportingTypes;

  @Field()
  readonly pmcEntityCode: SecuredStringNullable;

  @Field({
    deprecationReason: 'Use `growthPartnersClient` instead',
  })
  readonly globalInnovationsClient?: SecuredBoolean;

  @Field()
  readonly growthPartnersClient: SecuredBoolean;

  @Field()
  readonly active: SecuredBoolean;

  @Field()
  readonly address: SecuredStringNullable;

  readonly languageOfWiderCommunication: Secured<LinkTo<'Language'> | null>;

  readonly fieldRegions: Required<
    Secured<ReadonlyArray<LinkTo<'FieldRegion'>>>
  >;

  readonly countries: Required<Secured<ReadonlyArray<LinkTo<'Location'>>>>;

  readonly languagesOfConsulting: Required<
    Secured<ReadonlyArray<LinkTo<'Language'>>>
  >;

  @Field()
  readonly startDate: SecuredDateNullable;

  @DateTimeField()
  readonly modifiedAt: DateTime;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a partner'),
})
export class SecuredPartner extends SecuredProperty(Partner) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Partner: typeof Partner;
  }
  interface ResourceDBMap {
    Partner: typeof e.default.Partner;
  }
}
