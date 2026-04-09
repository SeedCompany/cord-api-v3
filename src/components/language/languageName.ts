import { type Language } from './dto';

export const languageName = (
  language: Partial<Pick<Language, 'name' | 'displayName'>>,
): string | undefined =>
  language.displayName?.value ||
  (language.name?.canRead ? language.name.value : undefined) ||
  undefined;
