import { Field, ObjectType } from '@nestjs/graphql';
import {
  DbLabel,
  DbUnique,
  Grandparent,
  IntersectTypes,
  NameField,
  Resource,
  type ResourceRelationsShape,
  type Secured,
  SecuredProperty,
  SecuredRoles,
  SecuredStringNullable,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Commentable } from '../../comments/dto';
import { Location } from '../../location/dto';
import { Organization } from '../../organization/dto';
import { Partner } from '../../partner/dto';
import { Pinnable } from '../../pin/dto';
import { IProject as Project } from '../../project/dto';
import { Education } from '../education/dto';
import { Unavailability } from '../unavailability/dto';
import { Actor } from './actor.dto';
import { SecuredGenderNullable } from './gender.enum';
import { KnownLanguage } from './known-language.dto';
import { SecuredUserStatus } from './user-status.enum';

const Interfaces = IntersectTypes(Resource, Actor, Pinnable, Commentable);

@RegisterResource({ db: e.User })
@ObjectType({
  implements: Interfaces.members,
})
@DbLabel('User', 'Actor')
export class User extends Interfaces {
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    education: [Education],
    organization: Organization,
    partner: Partner,
    unavailability: [Unavailability],
    locations: [Location],
    knownLanguage: [KnownLanguage],
    projects: [Project],
    ...Commentable.Relations(),
  })) satisfies ResourceRelationsShape;

  declare readonly __typename: 'User';

  @Field()
  @DbUnique('EmailAddress')
  email: SecuredStringNullable;

  // Nullable (migration 0042): Neo4j stores a name Property only when one was
  // written, and one migrated person has none. The GraphQL shape is unchanged —
  // `SecuredString.value` and `SecuredStringNullable.value` are both `String`.
  @NameField()
  @DbLabel('UserName')
  realFirstName: SecuredStringNullable;

  @NameField()
  @DbLabel('UserName')
  realLastName: SecuredStringNullable;

  @NameField()
  @DbLabel('UserName')
  displayFirstName: SecuredStringNullable;

  @NameField()
  @DbLabel('UserName')
  displayLastName: SecuredStringNullable;

  @Field()
  phone: SecuredStringNullable;

  timezone: SecuredStringNullable;

  @Field()
  about: SecuredStringNullable;

  @Field()
  status: SecuredUserStatus;

  @Field({
    middleware: [Grandparent.store],
  })
  roles: SecuredRoles;

  @Field()
  title: SecuredStringNullable;

  @Field()
  gender: SecuredGenderNullable;

  readonly photo: Secured<LinkTo<'File'> | null>;

  // Used by MarketingPolicy via the `isIntern` policy condition.
  // True iff this user is the `intern` on at least one InternshipEngagement.
  readonly isIntern?: boolean;
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
