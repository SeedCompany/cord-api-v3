import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  NameField,
  Resource,
  SecuredEnum,
  SecuredProperty,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
} from '../../../common';
import { SecuredRoles } from '../../authorization';
import { Location } from '../../location/dto';
import { Organization } from '../../organization/dto';
import { Education } from '../education/dto';
import { Unavailability } from '../unavailability/dto';
import { KnownLanguage } from './known-language.dto';
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
  static readonly Relations = {
    education: [Education],
    organization: Organization,
    unavailability: [Unavailability],
    locations: [Location],
    knownLanguage: [KnownLanguage],
  };

  @Field()
  @DbLabel('EmailAddress')
  email: SecuredStringNullable;

  @NameField()
  realFirstName: SecuredString;

  @NameField()
  realLastName: SecuredString;

  @NameField()
  displayFirstName: SecuredString;

  @NameField()
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
