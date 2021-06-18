import { Field, ObjectType } from '@nestjs/graphql';
import { ValueOf } from 'type-fest';
import { Resource } from '../../../common';
import { ResourceMap } from '../../authorization/model/resource-map';

type SomeResource = ValueOf<ResourceMap>;

@ObjectType({
  description:
    'The resources that have been added/removed/changed in a given changeset',
})
export class ChangesetDiff {
  @Field(() => [Resource], {
    description: 'The list of resources that have been added in this changeset',
  })
  readonly added: readonly SomeResource[];

  @Field(() => [Resource], {
    description:
      'The list of resources that have been removed in this changeset',
  })
  readonly removed: readonly SomeResource[];

  @Field(() => [Resource], {
    description:
      'The list of resources that have been changed in this changeset',
  })
  readonly changed: readonly SomeResource[];
}
