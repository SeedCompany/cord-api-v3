import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredEnum,
  SecuredProperty,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { SecuredRoles } from '../../authorization';
import { UserStatus } from './user-status.enum';

@ObjectType({
  description: SecuredProperty.descriptionFor('a user status'),
})
export abstract class SecuredUserStatus extends SecuredEnum(UserStatus) {}

@ObjectType({
  implements: [Resource],
})
export class User extends Resource {
  static readonly Props = keysOf<User>();
  static readonly SecuredProps = keysOf<SecuredProps<User>>();

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
  about: SecuredString;

  @Field()
  status: SecuredUserStatus;

  @Field()
  roles: SecuredRoles;

  @Field()
  title: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a user'),
})
export class SecuredUser extends SecuredProperty(User) {}
