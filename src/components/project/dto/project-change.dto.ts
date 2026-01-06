import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DataObject,
  DateTimeField,
  type ID,
  IdField,
  OmitType,
} from '~/common';
import { UpdateProject } from './update-project.dto';

@InterfaceType({
  resolveType: (x) => x.__typename,
})
export class AnyProjectChangeOrDeletion extends DataObject {
  readonly __typename: string;

  /**
   * WHY HERE:
   * We don't like exposing ID properties in output types,
   * favoring the actual object instead which holds its own id property.
   * We compromise here because a delete action cannot include the output type,
   * since it doesn't exist anymore.
   * This interface would be better as a union of the delete action or AnyProjectChange.
   * This way the delete action can give the ID directly, and any other project
   * change can give the project object.
   * Unfortunately, the GraphQL spec does not allow interfaces in unions.
   * https://github.com/graphql/graphql-js/issues/451
   */
  @IdField()
  readonly projectId: ID<'Project'>;

  @DateTimeField()
  at: DateTime;
}

@InterfaceType({
  implements: [AnyProjectChangeOrDeletion],
})
export class AnyProjectChange extends AnyProjectChangeOrDeletion {}

@ObjectType({ implements: [AnyProjectChange] })
export class ProjectCreated extends AnyProjectChange {
  declare readonly __typename: 'ProjectCreated';
}

@ObjectType()
export class ProjectChanges extends OmitType(UpdateProject, ['id']) {}

@ObjectType({ implements: [AnyProjectChange] })
export class ProjectUpdated extends AnyProjectChange {
  declare readonly __typename: 'ProjectUpdated';

  // @Field() private for now as links need resolvers
  changes: ProjectChanges;
}

@ObjectType({ implements: [AnyProjectChangeOrDeletion] })
export class ProjectDeleted extends AnyProjectChangeOrDeletion {
  declare readonly __typename: 'ProjectDeleted';
}
