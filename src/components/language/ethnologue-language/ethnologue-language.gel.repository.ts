import { Injectable } from '@nestjs/common';
import { type PublicOf } from '~/common';
import { RepoFor } from '~/core/gel';
import { EthnologueLanguage } from '../dto';
import { type EthnologueLanguageRepository } from './ethnologue-language.repository';

@Injectable()
export class EthnologueLanguageGelRepository
  extends RepoFor(EthnologueLanguage, {
    hydrate: (ethnoLang) => ({
      ...ethnoLang['*'],
      language: ethnoLang.language['*'],
    }),
  })
  implements PublicOf<EthnologueLanguageRepository> {}
