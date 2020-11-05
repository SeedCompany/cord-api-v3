import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { IdField } from '../../../common';
import { LanguageProficiency } from './language-proficiency.enum';

@ObjectType()
export abstract class KnownLanguage {
  language: string;

  @Field(() => LanguageProficiency)
  proficiency: LanguageProficiency;
}

@ArgsType()
export abstract class ModifyKnowLanguageArgs {
  @IdField()
  userId: string;

  @IdField()
  languageId: string;

  @Field(() => LanguageProficiency)
  languageProficiency: LanguageProficiency;
}
