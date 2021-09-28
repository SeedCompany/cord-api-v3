import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Language } from './dto';
import { LanguageService } from './language.service';

@Injectable({ scope: Scope.REQUEST })
export class LanguageLoader extends OrderedNestDataLoader<Language> {
  constructor(private readonly languages: LanguageService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.languages.readMany(ids, this.session);
  }
}
