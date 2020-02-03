import { Type } from '@nestjs/common';
import { Field, ObjectType } from 'type-graphql';
import { Resource, SecuredProperty, SecuredString } from '../../../common';

@ObjectType()
export class User extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (User as any) as Type<User>;

  @Field()
  email: SecuredString;

  @Field()
  realFirstName: SecuredString;

  @Field()
  realLastName: SecuredString;

  @Field()
  displayFirstName: SecuredString;

  @Field()
  displayLastName: SecuredString;

  @Field()
  phone: SecuredString;

  @Field()
  timezone: SecuredString;

  @Field()
  bio: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a user'),
})
export class SecuredUser extends SecuredProperty(User) {}
