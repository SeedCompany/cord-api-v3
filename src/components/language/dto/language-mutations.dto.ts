import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { Grandparent, type ID, IdField } from '~/common';
import { AsUpdateType } from '~/common/as-update.type';
import type { Language } from './language.dto';
import { UpdateLanguage } from './update-language.dto';

@InterfaceType()
export class LanguageMutationOrDeletion {
  @IdField({
    description: 'The language ID',
  })
  readonly languageId: ID<Language>;

  @Field(() => Date, { description: 'When the mutation occurred' })
  readonly at: DateTime;

  @IdField({ description: 'The user who initiated the change' })
  readonly by: ID<'User'>;
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
