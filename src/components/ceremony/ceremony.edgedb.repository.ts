import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { CeremonyRepository } from './ceremony.repository';
import { Ceremony, CreateCeremony } from './dto';

@Injectable()
export class CeremonyEdgeDBRepository
  extends RepoFor(Ceremony, {
    hydrate: (ceremony) => ({ ...ceremony['*'], engagement: true }),
  }).customize((cls, { defaults }) => {
    return class extends cls {
      static omit = [
        defaults.update,
        defaults.list,
        defaults.readMany,
        defaults.readOne,
      ];
      async create(input: CreateCeremony): Promise<any> {
        // EdgeDB creates these ceremonies in the process of creating the parent
        return;
      }
    };
  })
  implements PublicOf<CeremonyRepository> {}
