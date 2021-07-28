import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  NameField,
  Resource,
  SecuredProperty,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { ScopedRole } from '../../authorization';
import { Location } from '../../location/dto';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  static readonly Props = keysOf<Organization>();
  static readonly SecuredProps = keysOf<SecuredProps<Organization>>();
  static readonly Relations = {
    locations: [Location],
  };

  @NameField()
  @DbLabel('OrgName')
  readonly name: SecuredString;

  @Field()
  readonly address: SecuredString;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  readonly scope: ScopedRole[];
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}
