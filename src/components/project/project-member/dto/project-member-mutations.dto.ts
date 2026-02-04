import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DataObject,
  DateTimeField,
  Grandparent,
  type ID,
  IdField,
} from '~/common';
import { AsUpdateType } from '~/common/as-update.type';
import { UpdateProjectMember } from './update-project-member.dto';

@InterfaceType({
  resolveType: (x) => x.__typename,
})
export class ProjectMemberMutationOrDeletion extends DataObject {
  readonly __typename: string;

  /**
   * WHY HERE:
   * We don't like exposing ID properties in output types,
   * favoring the actual object instead which holds its own id property.
   * We compromise here because a delete action cannot include the output type,
   * since it doesn't exist anymore.
   * This interface would be better as a union of the delete action or ProjectMemberMutation.
   * This way the delete action can give the ID directly, and any other project member
   * change can give the project member object.
   * Unfortunately, the GraphQL spec does not allow interfaces in unions.
   * https://github.com/graphql/graphql-js/issues/451
   */
  @IdField()
  readonly projectMemberId: ID<'ProjectMember'>;

  @DateTimeField()
  at: DateTime;

  by: ID<'Actor'>;
}

@InterfaceType({
  implements: [ProjectMemberMutationOrDeletion],
})
export class ProjectMemberMutation extends ProjectMemberMutationOrDeletion {}

@ObjectType({ implements: [ProjectMemberMutation] })
export class ProjectMemberCreated extends ProjectMemberMutation {
  declare readonly __typename: 'ProjectMemberCreated';
}

@ObjectType()
export class ProjectMemberUpdate extends AsUpdateType(UpdateProjectMember, {
  omit: ['id'],
  links: [],
}) {}

@ObjectType({ implements: [ProjectMemberMutation] })
export class ProjectMemberUpdated extends ProjectMemberMutation {
  declare readonly __typename: 'ProjectMemberUpdated';

  @Field({ middleware: [Grandparent.store] })
  readonly previous: ProjectMemberUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: ProjectMemberUpdate;
}

@ObjectType({ implements: [ProjectMemberMutationOrDeletion] })
export class ProjectMemberDeleted extends ProjectMemberMutationOrDeletion {
  declare readonly __typename: 'ProjectMemberDeleted';
}
