import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { Resource, SecuredProperty, SecuredString } from '../../../common';
import { SecuredRoles } from '../../project/project-member/dto/role.dto';
import { UserStatus } from './user-status.enum';

@ObjectType({
  description: SecuredProperty.descriptionFor('a user status'),
})
export abstract class SecuredUserStatus extends SecuredProperty(UserStatus) {}

@ObjectType({
  implements: [Resource],
})
export class User extends Resource {
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

  @Field(() => SecuredRoles)
  roles: SecuredRoles;
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

export const RedactedSecuredRoles: SecuredRoles = {
  value: [],
  canRead: false,
  canEdit: false,
};

export const RedactedUser: Partial<User> = {
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
  roles: RedactedSecuredRoles,
};
