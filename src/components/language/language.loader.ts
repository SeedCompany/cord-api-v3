import { ID, ObjectView } from '~/common';
import { LoaderFactory, ObjectViewAwareLoader } from '~/core';
import { Language } from './dto';
import { LanguageService } from './language.service';

@LoaderFactory(() => Language)
export class LanguageLoader extends ObjectViewAwareLoader<Language> {
  constructor(private readonly languages: LanguageService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view: ObjectView) {
    return await this.languages.readMany(ids, this.session, view);
  }
}
