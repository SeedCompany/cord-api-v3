import { Field, InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type ID, IdField } from '~/common';
import { type LinkToUnknown } from '~/core/resources';
import { Changeset } from './changeset.dto';

@InterfaceType({
  description: stripIndent`
    An object that can be associated with change objects.
    The data returned in this object could be unique for the associated changeset
    returned.
  `,
})
// Maintaining previous functionality.
// This could be removed (and data migrated) to query it.
export abstract class ChangesetAware {
  @IdField({
    description: "The object's ID",
  })
  readonly id: ID;

  @Field(() => Changeset, {
    description: 'The current changeset that this object is for.',
    nullable: true,
  })
  readonly changeset?: ID;

  /**
   * A reference to the resource that owns this one — used for navigation
   * (breadcrumbs, `project: parent { … }`), not only for changesets.
   */
  readonly parent?: LinkToUnknown;
}
