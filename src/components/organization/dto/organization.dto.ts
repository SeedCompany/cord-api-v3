import { Field, ObjectType } from '@nestjs/graphql';
import {
  DbUnique,
  NameField,
  Resource,
  type ResourceRelationsShape,
  SecuredProperty,
  SecuredString,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { Location } from '../../location/dto';
import { SecuredOrganizationReach } from './organization-reach.dto';
import { SecuredOrganizationTypes } from './organization-type.dto';

@RegisterResource({ db: e.Organization })
@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    locations: [Location],
  })) satisfies ResourceRelationsShape;

  @NameField()
  @DbUnique('OrgName')
  readonly name: SecuredString;

  @NameField()
  readonly acronym: SecuredStringNullable;

  @Field()
  readonly address: SecuredStringNullable;

  @SensitivityField({
    description:
      "Based on the projects' lowest sensitivity, and defaults to 'High' if no project is connected",
  })
  readonly sensitivity: Sensitivity;

  @Field()
  readonly types: SecuredOrganizationTypes;

  @Field()
  readonly reach: SecuredOrganizationReach;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Organization: typeof Organization;
  }
  interface ResourceDBMap {
    Organization: typeof e.default.Organization;
  }
}
