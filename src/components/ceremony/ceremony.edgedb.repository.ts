import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { CeremonyRepository } from './ceremony.repository';
import { Ceremony, CreateCeremony } from './dto';

@Injectable()
export class CeremonyEdgeDBRepository
  extends RepoFor(Ceremony, {
    hydrate: (ceremony) => ({ ...ceremony['*'], engagement: true }),
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreateCeremony): Promise<any> {
        return;
      }
    };
  })
  implements PublicOf<CeremonyRepository> {}
