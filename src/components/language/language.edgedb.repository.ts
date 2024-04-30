import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
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
      presetInventory: e.bool(false), // Not implemented going forward
    }),
    omit: ['create'],
  })
  implements PublicOf<LanguageRepository>
{
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

  async getEngagementIdsForLanguage(language: Language) {
    const lang = e.cast(e.Language, e.uuid(language.id));
    const query = lang.engagements.id;

    return await this.db.run(query);
  }

  async hasFirstScriptureEngagement(id: ID) {
    const lang = e.cast(e.Language, e.uuid(id));
    const query = e.op('exists', lang.firstScriptureEngagement);
    return await this.db.run(query);
  }
}
