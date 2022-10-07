import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ValueOf } from 'type-fest';
import { Resource } from '~/common';
import { ResourceMap } from '~/core';

type SomeResource = ValueOf<ResourceMap>['prototype'];

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

  @Field(() => [ResourceChange], {
    description:
      'The list of resources (previous/updated pairs) that have been changed in this changeset',
  })
  readonly changed: readonly ResourceChange[];
}

@ObjectType({
  description: stripIndent`
    A resource from a changeset.
    These two properties will always be the same concrete type.
  `,
})
export class ResourceChange {
  @Field(() => Resource, {
    description: 'The currently active version of the resource',
  })
  readonly previous: SomeResource;

  @Field(() => Resource, {
    description: 'The version of the resource in this changeset',
  })
  readonly updated: SomeResource;
}
