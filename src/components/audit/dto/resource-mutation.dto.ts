import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { type DateTime } from 'luxon';
import {
  DateTimeField,
  type EnumType,
  type ID,
  makeEnum,
  PaginatedList,
  PaginationInput,
} from '~/common';
import { type LinkTo } from '~/core/resources';

export type MutationAction = EnumType<typeof MutationAction>;
export const MutationAction = makeEnum({
  name: 'MutationAction',
  values: ['Create', 'Update', 'Delete'],
});

/**
 * One entry in the general audit log — a single create/update/delete of a
 * resource, who did it, in what role, and (for updates) the changed fields.
 */
@ObjectType()
export class ResourceMutation {
  readonly id: string;

  @Field(() => MutationAction)
  readonly action: MutationAction;

  @DateTimeField()
  readonly at: DateTime;

  /** Resolved to a User by the resolver; null for system/anonymous actors. */
  readonly actor: LinkTo<'User'> | null;

  @Field(() => [String], {
    description:
      'The role(s) the actor held at the moment of the mutation. Stored as a ' +
      'decoupled snapshot (plain role names, not the live Role enum) so the ' +
      'append-only record is immune to later role changes; empty for ' +
      'system/anonymous actors.',
  })
  readonly roleAtTime: readonly string[];

  @Field(() => GraphQLJSONObject, {
    nullable: true,
    description: 'The fields that changed (updates only)',
  })
  readonly changes: Record<string, unknown> | null;
}

@InputType()
export class ResourceMutationListInput extends PaginationInput {}

@ObjectType()
export class ResourceMutationList extends PaginatedList(ResourceMutation) {}

export interface RecordMutationInput {
  readonly resourceType: string;
  readonly resourceId: ID;
  readonly action: MutationAction;
  readonly actorId: ID<'User'> | null;
  readonly roleAtTime: readonly string[];
  readonly changes?: Record<string, unknown> | null;
}
