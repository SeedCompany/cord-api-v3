import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { Grandparent, type ID, IdField } from '~/common';
import { AsUpdateType } from '~/common/as-update.type';
import type { LinkTo } from '~/core/resources';
import { ProjectMutation } from '../../project/dto/project-mutations.dto';
import { InternshipEngagement, LanguageEngagement } from './engagement.dto';
import {
  UpdateEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './update-engagement.dto';

@InterfaceType({ implements: [ProjectMutation] })
export class EngagementMutationOrDeletion extends ProjectMutation {
  /** Why here? See {@link ProjectMutation.projectId} */
  @IdField()
  readonly engagementId: ID<'Engagement'>;
}

@InterfaceType({ implements: [EngagementMutationOrDeletion] })
export class EngagementMutation extends EngagementMutationOrDeletion {}

@InterfaceType({ implements: [EngagementMutation] })
export class LanguageEngagementMutation extends EngagementMutation {
  @Field(() => LanguageEngagement)
  readonly engagement?: never; // Resolved from EngagementMutation with EngagementMutationLinksResolver
}

@InterfaceType({ implements: [EngagementMutation] })
export class InternshipEngagementMutation extends EngagementMutation {
  @Field(() => InternshipEngagement)
  readonly engagement?: never; // Resolved from EngagementMutation with EngagementMutationLinksResolver
}

@InterfaceType({ implements: [EngagementMutation] })
export abstract class EngagementCreated extends EngagementMutation {}

@ObjectType({ implements: [LanguageEngagementMutation, EngagementCreated] })
export class LanguageEngagementCreated extends EngagementCreated {
  declare readonly __typename: 'LanguageEngagementCreated';

  @Field(() => LanguageEngagement)
  readonly engagement?: never; // Resolved from EngagementMutation with EngagementMutationLinksResolver
}

@ObjectType({ implements: [InternshipEngagementMutation, EngagementCreated] })
export class InternshipEngagementCreated extends EngagementCreated {
  declare readonly __typename: 'InternshipEngagementCreated';

  @Field(() => InternshipEngagement)
  readonly engagement?: never; // Resolved from EngagementMutation with EngagementMutationLinksResolver
}

@InterfaceType()
export class EngagementUpdate extends AsUpdateType(UpdateEngagement, {
  omit: ['id'],
  links: [],
}) {}

@ObjectType({ implements: [EngagementUpdate] })
export class LanguageEngagementUpdate extends AsUpdateType(
  UpdateLanguageEngagement,
  {
    omit: ['id', 'changeset', 'pnp'],
    links: [],
  },
) {
  readonly pnp?: LinkTo<'FileVersion'>;
}

@ObjectType({ implements: [EngagementUpdate] })
export class InternshipEngagementUpdate extends AsUpdateType(
  UpdateInternshipEngagement,
  {
    omit: ['id', 'changeset', 'growthPlan'],
    links: ['mentor', 'countryOfOrigin'],
  },
) {
  readonly growthPlan?: LinkTo<'FileVersion'>;
}

@InterfaceType({ implements: [EngagementMutation] })
export class EngagementUpdated extends EngagementMutation {
  @Field({ middleware: [Grandparent.store] })
  readonly previous: EngagementUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: EngagementUpdate;
}

@ObjectType({ implements: [LanguageEngagementMutation, EngagementUpdated] })
export class LanguageEngagementUpdated extends EngagementUpdated {
  declare readonly __typename: 'LanguageEngagementUpdated';

  @Field({ middleware: [Grandparent.store] })
  declare readonly previous: LanguageEngagementUpdate;

  @Field({ middleware: [Grandparent.store] })
  declare readonly updated: LanguageEngagementUpdate;

  @Field(() => LanguageEngagement)
  readonly engagement?: never; // Resolved from EngagementMutation with EngagementMutationLinksResolver
}

@ObjectType({ implements: [InternshipEngagementMutation, EngagementUpdated] })
export class InternshipEngagementUpdated extends EngagementUpdated {
  declare readonly __typename: 'InternshipEngagementUpdated';

  @Field({ middleware: [Grandparent.store] })
  declare readonly previous: InternshipEngagementUpdate;

  @Field({ middleware: [Grandparent.store] })
  declare readonly updated: InternshipEngagementUpdate;

  @Field(() => InternshipEngagement)
  readonly engagement?: never; // Resolved from EngagementMutation with EngagementMutationLinksResolver
}

@InterfaceType({ implements: [EngagementMutationOrDeletion] })
export class EngagementDeleted extends EngagementMutationOrDeletion {}

@ObjectType({ implements: [EngagementDeleted] })
export class LanguageEngagementDeleted extends EngagementDeleted {
  declare readonly __typename: 'LanguageEngagementDeleted';
}

@ObjectType({ implements: [EngagementDeleted] })
export class InternshipEngagementDeleted extends EngagementDeleted {
  declare readonly __typename: 'InternshipEngagementDeleted';
}
