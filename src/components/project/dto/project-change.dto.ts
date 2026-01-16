import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import {
  DataObject,
  DateTimeField,
  Grandparent,
  type ID,
  IdField,
} from '~/common';
import { AsChangesType } from '~/common/as-changes.type';
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
export class ProjectChanges extends AsChangesType(UpdateProject, {
  omit: ['id'],
  links: [
    'primaryLocation',
    'marketingLocation',
    'marketingRegionOverride',
    'fieldRegion',
  ],
}) {}

@ObjectType({ implements: [AnyProjectChange] })
export class ProjectUpdated extends AnyProjectChange {
  declare readonly __typename: 'ProjectUpdated';

  // TODO maybe updates: ProjectUpdates
  //  avoid ambiguity with AnyProjectChange
  //  and it is only project's own properties that change, not nested.
  @Field({ middleware: [Grandparent.store] })
  readonly changes: ProjectChanges;

  // TODO should this be here or in ProjectChanges.
  //   ProjectUpdated.changeKeys
  //                 .changes
  //      or
  //   ProjectUpdated.changes.changeKeys
  @Field(() => [String], {
    description: stripIndent`
      A list of keys of this object which have changed.

      If your GQL usage cannot distinguish between omitted fields and explicit nulls,
      this can be used to determine which fields have changed.
    `,
  })
  readonly changedKeys: ReadonlyArray<keyof ProjectChanges>;
}

@ObjectType({ implements: [AnyProjectChangeOrDeletion] })
export class ProjectDeleted extends AnyProjectChangeOrDeletion {
  declare readonly __typename: 'ProjectDeleted';
}
