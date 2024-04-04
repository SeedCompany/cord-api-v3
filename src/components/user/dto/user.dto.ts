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
  SecuredRoles,
  SecuredString,
  SecuredStringNullable,
} from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
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

@RegisterResource({ db: e.User })
@ObjectType({
  implements: [Resource, Pinnable],
})
export class User extends PinnableResource {
  static readonly Props = keysOf<User>();
  static readonly SecuredProps = keysOf<SecuredProps<User>>();
  static readonly Relations = () =>
    ({
      education: [Education],
      organization: Organization,
      partner: Partner,
      unavailability: [Unavailability],
      locations: [Location],
      knownLanguage: [KnownLanguage],
      projects: [Project],
    } satisfies ResourceRelationsShape);

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
  phone: SecuredStringNullable;

  timezone: SecuredString;

  @Field()
  about: SecuredStringNullable;

  @Field()
  status: SecuredUserStatus;

  @Field()
  roles: SecuredRoles;

  @Field()
  title: SecuredStringNullable;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a user'),
})
export class SecuredUser extends SecuredProperty(User) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    User: typeof User;
  }
  interface ResourceDBMap {
    User: typeof e.default.User;
  }
}
