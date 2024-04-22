import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { DbTypeOf } from '~/core';
import { ChangesOf } from '~/core/database/changes';
import { RepoFor } from '~/core/edgedb';
import { CeremonyRepository } from './ceremony.repository';
import { Ceremony, CreateCeremony, UpdateCeremony } from './dto';

@Injectable()
export class CeremonyEdgeDBRepository
  extends RepoFor(Ceremony, {
    hydrate: (ceremony) => ({ ...ceremony['*'], engagement: true }),
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreateCeremony): Promise<any> {
        return;
      }
      async update(
        existing: DbTypeOf<Ceremony>,
        changes: ChangesOf<Ceremony, UpdateCeremony>,
      ) {
        return;
      }
    };
  })
  implements PublicOf<CeremonyRepository> {}
