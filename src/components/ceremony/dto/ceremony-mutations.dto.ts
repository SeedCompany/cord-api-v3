import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  AsUpdateType,
  DateTimeField,
  Grandparent,
  type ID,
  IdField,
} from '~/common';
import type { Ceremony } from './ceremony.dto';
import { UpdateCeremony } from './update-ceremony.dto';

@InterfaceType()
export class CeremonyMutationOrDeletion {
  readonly __typename: string;

  /** Why here? See {@link ProjectMutation.projectId} */
  @IdField()
  readonly ceremonyId: ID<Ceremony>;

  @DateTimeField()
  readonly at: DateTime;

  readonly by: ID<'Actor'>;
}

@InterfaceType({ implements: [CeremonyMutationOrDeletion] })
export class CeremonyMutation extends CeremonyMutationOrDeletion {}

@ObjectType({ implements: [CeremonyMutation] })
export class CeremonyCreated extends CeremonyMutation {
  declare readonly __typename: 'CeremonyCreated';
}

@ObjectType()
export class CeremonyUpdate extends AsUpdateType(UpdateCeremony, {
  omit: ['id'],
  links: [],
}) {}

@ObjectType({ implements: [CeremonyMutation] })
export class CeremonyUpdated extends CeremonyMutation {
  declare readonly __typename: 'CeremonyUpdated';

  @Field({ middleware: [Grandparent.store] })
  readonly previous: CeremonyUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: CeremonyUpdate;
}

@ObjectType({ implements: [CeremonyMutationOrDeletion] })
export class CeremonyDeleted extends CeremonyMutationOrDeletion {
  declare readonly __typename: 'CeremonyDeleted';
}
