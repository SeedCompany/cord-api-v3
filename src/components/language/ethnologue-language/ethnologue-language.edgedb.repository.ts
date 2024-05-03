import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { EthnologueLanguage } from '../dto';
import { EthnologueLanguageRepository } from './ethnologue-language.repository';

@Injectable()
export class EthnologueLanguageEdgeDBRepository
  extends RepoFor(EthnologueLanguage, {
    hydrate: (ethnoLang) => ({
      ...ethnoLang['*'],
      language: ethnoLang.language['*'],
    }),
  })
  implements PublicOf<EthnologueLanguageRepository> {}
