import { registerEnumType } from '@nestjs/graphql';

export enum LanguageProficiency {
  Beginner = 'Beginner',
  Conversational = 'Conversational',
  Skilled = 'Skilled',
  Fluent = 'Fluent',
}

registerEnumType(LanguageProficiency, {
  name: 'LanguageProficiency',
});
