import { Field, ObjectType } from '@nestjs/graphql';
import { Resource } from '../../../common';

@ObjectType({
  description:
    'The resources that have been added/removed/changed in a given changeset',
})
export class ChangesetDiff {
  @Field(() => [Resource], {
    description: 'The list of resources that have been added in this changeset',
  })
  readonly added: readonly Resource[];

  @Field(() => [Resource], {
    description:
      'The list of resources that have been removed in this changeset',
  })
  readonly removed: readonly Resource[];

  @Field(() => [Resource], {
    description:
      'The list of resources that have been changed in this changeset',
  })
  readonly changed: readonly Resource[];
}
