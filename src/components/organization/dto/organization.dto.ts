import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core';
import {
  DbUnique,
  NameField,
  Resource,
  ResourceRelationsShape,
  SecuredProperty,
  SecuredProps,
  SecuredString,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { Location } from '../../location/dto';

@RegisterResource()
@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  static readonly Props = keysOf<Organization>();
  static readonly SecuredProps = keysOf<SecuredProps<Organization>>();
  static readonly Relations = {
    locations: [Location],
  } satisfies ResourceRelationsShape;

  @NameField()
  @DbUnique('OrgName')
  readonly name: SecuredString;

  @Field()
  readonly address: SecuredString;

  @SensitivityField({
    description:
      "Based on the projects' lowest sensitivity, and defaults to 'High' if no project is connected",
  })
  readonly sensitivity: Sensitivity;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Organization: typeof Organization;
  }
}
