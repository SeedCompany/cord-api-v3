import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbUnique,
  IntersectionType,
  NameField,
  Resource,
  ResourceRelationsShape,
  SecuredEnum,
  SecuredProperty,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
} from '../../../common';
import { SecuredRoles } from '../../authorization';
import { Location } from '../../location/dto';
import { Organization } from '../../organization/dto';
import { Partner } from '../../partner/dto';
import { Pinnable } from '../../pin/dto';
import { IProject as Project } from '../../project/dto';
import { Education } from '../education/dto';
import { Unavailability } from '../unavailability/dto';
import { KnownLanguage } from './known-language.dto';
import { UserStatus } from './user-status.enum';

const PinnableResource: Type<Resource & Pinnable> = IntersectionType(
  Resource,
  Pinnable,
);

@ObjectType({
  description: SecuredProperty.descriptionFor('a user status'),
})
export abstract class SecuredUserStatus extends SecuredEnum(UserStatus) {}

@ObjectType({
  implements: [Resource, Pinnable],
})
export class User extends PinnableResource {
  static readonly Props = keysOf<User>();
  static readonly SecuredProps = keysOf<SecuredProps<User>>();
  static readonly Relations = {
    education: [Education],
    organization: Organization,
    partner: Partner,
    unavailability: [Unavailability],
    locations: [Location],
    knownLanguage: [KnownLanguage],
    projects: [Project],
  } satisfies ResourceRelationsShape;

  @Field()
  @DbUnique('EmailAddress')
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
