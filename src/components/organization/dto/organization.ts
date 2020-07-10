import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  @Field()
  readonly name: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}
