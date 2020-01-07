import { Language } from '../language';
import { LanguageProficiency } from './language-proficiency';

export interface KnownLanguage {
  language: Language;
  proficiency: LanguageProficiency;
}
