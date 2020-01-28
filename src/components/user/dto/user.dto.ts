import { Field, ObjectType } from 'type-graphql';
import { Resource, SecuredString } from '../../../common';

@ObjectType()
export class User extends Resource {
  @Field()
  readonly email: SecuredString;

  @Field()
  readonly realFirstName: SecuredString;

  @Field()
  readonly realLastName: SecuredString;

  @Field()
  readonly displayFirstName: string;

  @Field()
  readonly displayLastName: string;

  @Field()
  readonly phone: SecuredString;

  @Field()
  readonly timezone: SecuredString;

  @Field()
  readonly bio: SecuredString;
}
