import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { e, EdgeDB, RepoFor } from '~/core/edgedb';
import { Language } from './dto';
import { LanguageRepository } from './language.repository';

@Injectable()
export class LanguageEdgeDBRepository
  extends RepoFor(Language, {
    hydrate: (lang) => ({
      ...lang['*'],
      ethnologue: lang.ethnologue['*'],
      firstScriptureEngagement: lang.firstScriptureEngagement['*'],
      effectiveSensitivity: lang.sensitivity,
    }),
  }).withDefaults()
  implements PublicOf<LanguageRepository>
{
  constructor(private readonly edgedb: EdgeDB) {
    super();
  }

  async getEngagementIdsForLanguage(language: Language) {
    const lang = e.cast(e.Language, e.uuid(language.id));

    const query = e.select(lang).engagements.id;

    return await this.edgedb.run(query);
  }
}
