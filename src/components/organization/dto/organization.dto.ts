import { Field, ObjectType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core/resources';
import {
  DbUnique,
  NameField,
  Resource,
  ResourceRelationsShape,
  SecuredProperty,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { Location } from '../../location/dto';
import { SecuredMailingAddress } from '../../mailing-address';
import { SecuredOrganizationReach } from './organization-reach.dto';
import { SecuredOrganizationTypes } from './organization-type.dto';

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

  @NameField()
  readonly acronym: SecuredStringNullable;

  @Field(() => SecuredMailingAddress)
  @ValidateNested()
  readonly address: SecuredMailingAddress;

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
}
