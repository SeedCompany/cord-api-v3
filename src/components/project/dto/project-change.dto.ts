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
