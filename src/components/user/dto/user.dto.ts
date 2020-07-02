import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { Resource, SecuredProperty, SecuredString } from '../../../common';
import { UserStatus } from './user-status.enum';

@ObjectType({
  description: SecuredProperty.descriptionFor('a user status'),
})
export abstract class SecuredUserStatus extends SecuredProperty(UserStatus) {}

@ObjectType({
  implements: [Resource],
})
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

  timezone: SecuredString;

  @Field()
  bio: SecuredString;

  @Field(() => SecuredUserStatus)
  status: SecuredUserStatus;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a user'),
})
export class SecuredUser extends SecuredProperty(User) {}

export const RedactedSecuredString: SecuredString = {
  value: undefined,
  canRead: false,
  canEdit: false,
};

export const RedactedUser: User = {
  id: '',
  createdAt: DateTime.fromSeconds(0),
  email: RedactedSecuredString,
  realFirstName: RedactedSecuredString,
  realLastName: RedactedSecuredString,
  displayFirstName: RedactedSecuredString,
  displayLastName: RedactedSecuredString,
  phone: RedactedSecuredString,
  timezone: RedactedSecuredString,
  bio: RedactedSecuredString,
  status: RedactedSecuredString,
};
