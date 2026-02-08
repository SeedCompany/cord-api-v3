import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, Grandparent, type ID, IdField } from '~/common';
import { AsUpdateType } from '~/common/as-update.type';
import type { Language } from './language.dto';
import { UpdateLanguage } from './update-language.dto';

@InterfaceType({
  resolveType: (x) => x.__typename,
})
export class LanguageMutationOrDeletion {
  readonly __typename: string;

  /**
   * The language ID.
   * This is exposed directly for delete actions since the deleted language
   * cannot be included in the payload.
   */
  @IdField()
  readonly languageId: ID<Language>;

  @DateTimeField()
  at: DateTime;

  by: ID<'Actor'>;
}

@InterfaceType({ implements: [LanguageMutationOrDeletion] })
export class LanguageMutation extends LanguageMutationOrDeletion {}

@ObjectType({ implements: [LanguageMutation] })
export class LanguageCreated extends LanguageMutation {
  declare readonly __typename: 'LanguageCreated';
}

@ObjectType()
export class LanguageUpdate extends AsUpdateType(UpdateLanguage, {
  omit: ['id', 'changeset'],
  links: [],
}) {}

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
