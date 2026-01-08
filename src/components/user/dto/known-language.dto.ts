import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';
import { LanguageProficiency } from './language-proficiency.enum';

@ObjectType()
export abstract class KnownLanguage {
  language: ID;

  @Field(() => LanguageProficiency)
  proficiency: LanguageProficiency;
}

@ArgsType()
export abstract class ModifyKnownLanguageArgs {
  @IdField()
  user: ID<'User'>;

  @IdField()
  language: ID<'Language'>;

  @Field(() => LanguageProficiency)
  languageProficiency: LanguageProficiency;
}
