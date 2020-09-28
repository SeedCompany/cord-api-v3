import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredEnum,
  SecuredKeys,
  SecuredProperty,
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

  @Field()
  status: SecuredUserStatus;

  @Field()
  roles: SecuredRoles;

  @Field()
  title: SecuredString;
}

declare module '../../authorization/policies/mapping' {
  interface TypeToDto {
    User: User;
  }
  interface TypeToSecuredProps {
    User: SecuredKeys<User> | 'education' | 'unavailability';
  }
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a user'),
})
export class SecuredUser extends SecuredProperty(User) {}
