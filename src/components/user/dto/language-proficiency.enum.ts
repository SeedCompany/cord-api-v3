import { EnumType, makeEnum } from '~/common';

export type LanguageProficiency = EnumType<typeof LanguageProficiency>;
export const LanguageProficiency = makeEnum({
  name: 'LanguageProficiency',
  values: ['Beginner', 'Conversational', 'Skilled', 'Fluent'],
});
