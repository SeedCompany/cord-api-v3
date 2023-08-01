import { ArgsType, Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, IdField, SecuredProps } from '~/common';
import { LanguageProficiency } from './language-proficiency.enum';

@ObjectType()
export abstract class KnownLanguage {
  static readonly Props = keysOf<KnownLanguage>();
  static readonly SecuredProps = keysOf<SecuredProps<KnownLanguage>>();

  language: ID;

  @Field(() => LanguageProficiency)
  proficiency: LanguageProficiency;
}

@ArgsType()
export abstract class ModifyKnownLanguageArgs {
  @IdField()
  userId: ID;

  @IdField()
  languageId: ID;

  @Field(() => LanguageProficiency)
  languageProficiency: LanguageProficiency;
}
