import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import {
  AsUpdateType,
  type CollectionMutationType,
  DateTimeField,
  Grandparent,
  type ID,
  IdField,
} from '~/common';
import type { LinkTo } from '~/core/resources';
import { UpdateUser } from './update-user.dto';
import type { User } from './user.dto';

@InterfaceType()
export class UserMutationOrDeletion {
  readonly __typename: string;

  /** Why here? See {@link ProjectMutation.projectId} */
  @IdField()
  readonly userId: ID<User>;

  @DateTimeField()
  readonly at: DateTime;

  readonly by: ID<'Actor'>;
}

@InterfaceType({ implements: [UserMutationOrDeletion] })
export class UserMutation extends UserMutationOrDeletion {}

@ObjectType({
  implements: [UserMutation],
  description: stripIndent`
    A user/person was created.

    \`by\` names the responsible actor, which differs by how it happened:
    - Another logged in user created them, and they do not have login
      credentials set yet. \`by\` is that user.
    - They registered themselves. \`by\` is the \`Anonymous\` system agent,
      since an unauthenticated request has no actor of its own. In the unusual
      case of an already logged in requester registering, \`by\` is that user.
    - They were created outside of any request, by seeding or root user
      bootstrap. \`by\` is the new user themselves, as there is no other actor
      to name.
  `,
})
export class UserCreated extends UserMutation {
  declare readonly __typename: 'UserCreated';
}

/**
 * Deliberately omits the identifying/contact fields from the GraphQL surface.
 * They are not secured per-field here — the subscription only verifies the
 * watcher can read the user at all — so exposing them would hand subscribers
 * values that field-level privileges may not permit. `updatedKeys` still
 * reports that they changed, which is enough for a subscriber to re-read `user`
 * under its own privileges.
 *
 * Note this omission is type-level only. `AsUpdateType`'s `fromInput` and
 * `pickPrevious` drop nothing but `modifiedAt`, so the values remain on the
 * published payload object and travel the broadcast channels; the schema is
 * what keeps them from being selectable. Matches every other CDC domain.
 */
@ObjectType()
export class UserUpdate extends AsUpdateType(UpdateUser, {
  omit: [
    'id',
    'photo',
    'email',
    'phone',
    'realFirstName',
    'realLastName',
    'about',
  ],
  links: [],
}) {
  // Not `@Field`s; exposed as secured values by UserUpdateLinksResolver.
  readonly photo?: LinkTo<'FileVersion'>;

  readonly locations?: Partial<
    Record<CollectionMutationType, ReadonlyArray<ID<'Location'>>>
  >;

  // TODO An `organizations` delta belongs here alongside `locations`, but the
  //  repositories cannot yet report whether an assignment changed anything, and
  //  the `primary` flag does not fit a plain Added/Removed shape. See the TODO
  //  on UserService.assignOrganizationToUser.
}

@ObjectType({ implements: [UserMutation] })
export class UserUpdated extends UserMutation {
  declare readonly __typename: 'UserUpdated';

  @Field({ middleware: [Grandparent.store] })
  readonly previous: UserUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: UserUpdate;
}

@ObjectType({ implements: [UserMutationOrDeletion] })
export class UserDeleted extends UserMutationOrDeletion {
  declare readonly __typename: 'UserDeleted';
}
