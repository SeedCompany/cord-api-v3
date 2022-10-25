import { Field, InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField } from '~/common';
import { BaseNode } from '~/core/database/results';
import { Changeset } from './changeset.dto';

@InterfaceType({
  description: stripIndent`
    An object that can be associated with change objects.
    The data returned in this object could be unique for the associated changeset
    returned.
  `,
})
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

  readonly parent?: BaseNode;
}
