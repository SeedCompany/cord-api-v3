import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Organization extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Organization as any) as Type<Organization>;

  @Field()
  readonly name: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an organization'),
})
export class SecuredOrganization extends SecuredProperty(Organization) {}
