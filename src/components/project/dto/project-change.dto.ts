import { InterfaceType, ObjectType } from '@nestjs/graphql';
import { DataObject, type ID, IdField } from '~/common';

@InterfaceType({
  resolveType: (x) => x.__typename,
})
export class AnyProjectChangeOrDeletion extends DataObject {
  readonly __typename: string;

  @IdField()
  readonly projectId: ID<'Project'>;
}

@InterfaceType({
  implements: [AnyProjectChangeOrDeletion],
})
export class AnyProjectChange extends AnyProjectChangeOrDeletion {}

@ObjectType({ implements: [AnyProjectChange] })
export class ProjectCreated extends AnyProjectChange {
  declare readonly __typename: 'ProjectCreated';
}

@ObjectType({ implements: [AnyProjectChange] })
export class ProjectUpdated extends AnyProjectChange {
  declare readonly __typename: 'ProjectUpdated';
}

@ObjectType({ implements: [AnyProjectChangeOrDeletion] })
export class ProjectDeleted extends AnyProjectChangeOrDeletion {
  declare readonly __typename: 'ProjectDeleted';
}
