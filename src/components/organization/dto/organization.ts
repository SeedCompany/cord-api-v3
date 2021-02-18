import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredBoolean,
  SecuredProperty,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  @Field()
  readonly name: SecuredString;

  @Field()
  readonly address: SecuredString;

  readonly canDelete: SecuredBoolean;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}
