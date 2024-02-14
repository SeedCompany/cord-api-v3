import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { CreateLanguage, Language } from './dto';
import { LanguageRepository } from './language.repository';

@Injectable()
export class LanguageEdgeDBRepository
  extends RepoFor(Language, {
    hydrate: (lang) => ({
      ...lang['*'],
      ethnologue: lang.ethnologue['*'],
      firstScriptureEngagement: true,
      sensitivity: lang.ownSensitivity,
      effectiveSensitivity: lang.sensitivity,
    }),
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreateLanguage) {
        const { sensitivity, ethnologue, ...props } = input;

        const createdLanguage = e.insert(e.Language, {
          ...props,
          ownSensitivity: input.sensitivity,
        });
        const { language } = e.insert(e.Ethnologue.Language, {
          language: createdLanguage,
          projectContext: createdLanguage.projectContext,
          ...ethnologue,
        });
        const query = e.select(language, this.hydrate);

        return await this.db.run(query);
      }
    };
  })
  implements PublicOf<LanguageRepository>
{
  async getEngagementIdsForLanguage(language: Language) {
    const lang = e.cast(e.Language, e.uuid(language.id));
    const query = lang.engagements.id;

    return await this.db.run(query);
  }
}
