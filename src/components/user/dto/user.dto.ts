import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DbLabel,
  DbUnique,
  IntersectTypes,
  NameField,
  Resource,
  ResourceRelationsShape,
  SecuredProperty,
  SecuredProps,
  SecuredRoles,
  SecuredString,
  SecuredStringNullable,
} from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { Commentable } from '../../comments/dto';
import { Location } from '../../location/dto';
import { Organization } from '../../organization/dto';
import { Partner } from '../../partner/dto';
import { Pinnable } from '../../pin/dto';
import { IProject as Project } from '../../project/dto';
import { Education } from '../education/dto';
import { Unavailability } from '../unavailability/dto';
import { Actor } from './actor.dto';
import { KnownLanguage } from './known-language.dto';
import { SecuredUserStatus } from './user-status.enum';

const Interfaces = IntersectTypes(Resource, Actor, Pinnable, Commentable);

@RegisterResource({ db: e.User })
@ObjectType({
  implements: Interfaces.members,
})
@DbLabel('User', 'Actor')
export class User extends Interfaces {
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
      ...Commentable.Relations,
    } satisfies ResourceRelationsShape);

  @Field()
  @DbUnique('EmailAddress')
  email: SecuredStringNullable;

  @NameField()
  @DbLabel('UserName')
  realFirstName: SecuredString;

  @NameField()
  @DbLabel('UserName')
  realLastName: SecuredString;

  @NameField()
  @DbLabel('UserName')
  displayFirstName: SecuredString;

  @NameField()
  @DbLabel('UserName')
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
