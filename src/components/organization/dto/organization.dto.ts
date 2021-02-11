import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProperty, SecuredString } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  static readonly Props = keysOf<Organization>();

  @Field()
  readonly name: SecuredString;

  @Field()
  readonly address: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}
