import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  AsUpdateType,
  type CollectionMutationType,
  DateTimeField,
  Grandparent,
  type ID,
  IdField,
} from '~/common';
import type { Language } from './language.dto';
import {
  UpdateEthnologueLanguage,
  UpdateLanguage,
} from './update-language.dto';

@InterfaceType()
export class LanguageMutationOrDeletion {
  readonly __typename: string;

  /** Why here? See {@link ProjectMutation.projectId} */
  @IdField()
  readonly languageId: ID<Language>;

  @DateTimeField()
  readonly at: DateTime;

  readonly by: ID<'Actor'>;
}

@InterfaceType({ implements: [LanguageMutationOrDeletion] })
export class LanguageMutation extends LanguageMutationOrDeletion {}

@ObjectType({ implements: [LanguageMutation] })
export class LanguageCreated extends LanguageMutation {
  declare readonly __typename: 'LanguageCreated';
}

@ObjectType()
export class EthnologueLanguageUpdate extends AsUpdateType(
  UpdateEthnologueLanguage,
  {
    omit: [],
    links: [],
  },
) {}

@ObjectType()
export class LanguageUpdate extends AsUpdateType(UpdateLanguage, {
  omit: ['id', 'changeset', 'ethnologue', 'registryOfDialectsCode'],
  links: [],
}) {
  @Field({ nullable: true })
  readonly ethnologue?: EthnologueLanguageUpdate;

  readonly locations?: Partial<
    Record<CollectionMutationType, ReadonlyArray<ID<'Location'>>>
  >;
}

@ObjectType({ implements: [LanguageMutation] })
export class LanguageUpdated extends LanguageMutation {
  declare readonly __typename: 'LanguageUpdated';

  @Field({ middleware: [Grandparent.store] })
  readonly previous: LanguageUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: LanguageUpdate;
}

@ObjectType({ implements: [LanguageMutationOrDeletion] })
export class LanguageDeleted extends LanguageMutationOrDeletion {
  declare readonly __typename: 'LanguageDeleted';
}
