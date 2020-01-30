import { Type } from '@nestjs/common';
import { Field, ObjectType } from 'type-graphql';
import { Resource, SecuredString } from '../../../common';

@ObjectType()
export class User extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (User as any) as Type<User>;

  @Field()
  readonly email: SecuredString;

  @Field()
  readonly realFirstName: SecuredString;

  @Field()
  readonly realLastName: SecuredString;

  @Field()
  readonly displayFirstName: SecuredString;

  @Field()
  readonly displayLastName: SecuredString;

  @Field()
  readonly phone: SecuredString;

  @Field()
  readonly timezone: SecuredString;

  @Field()
  readonly bio: SecuredString;
}
