import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  type CollectionMutationType,
  DataObject,
  DateTimeField,
  Grandparent,
  type ID,
  IdField,
} from '~/common';
import { AsUpdateType } from '~/common/as-update.type';
import { UpdateProject } from './update-project.dto';

@InterfaceType({
  resolveType: (x) => x.__typename,
})
export class ProjectMutationOrDeletion extends DataObject {
  readonly __typename: string;

  /**
   * WHY HERE:
   * We don't like exposing ID properties in output types,
   * favoring the actual object instead which holds its own id property.
   * We compromise here because a delete action cannot include the output type,
   * since it doesn't exist anymore.
   * This interface would be better as a union of the delete action or ProjectMutation.
   * This way the delete action can give the ID directly, and any other project
   * change can give the project object.
   * Unfortunately, the GraphQL spec does not allow interfaces in unions.
   * https://github.com/graphql/graphql-js/issues/451
   */
  @IdField()
  readonly projectId: ID<'Project'>;

  @DateTimeField()
  at: DateTime;

  by: ID<'Actor'>;
}

@InterfaceType({
  implements: [ProjectMutationOrDeletion],
})
export class ProjectMutation extends ProjectMutationOrDeletion {}

@ObjectType({ implements: [ProjectMutation] })
export class ProjectCreated extends ProjectMutation {
  declare readonly __typename: 'ProjectCreated';
}

@ObjectType()
export class ProjectUpdate extends AsUpdateType(UpdateProject, {
  omit: ['id', 'changeset'],
  links: [
    'primaryLocation',
    'marketingLocation',
    'marketingRegionOverride',
    'fieldRegion',
  ],
}) {
  readonly otherLocations?: Partial<
    Record<CollectionMutationType, ReadonlyArray<ID<'Location'>>>
  >;
}

@ObjectType({ implements: [ProjectMutation] })
export class ProjectUpdated extends ProjectMutation {
  declare readonly __typename: 'ProjectUpdated';

  @Field({ middleware: [Grandparent.store] })
  readonly previous: ProjectUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: ProjectUpdate;
}

@ObjectType({ implements: [ProjectMutationOrDeletion] })
export class ProjectDeleted extends ProjectMutationOrDeletion {
  declare readonly __typename: 'ProjectDeleted';
}
