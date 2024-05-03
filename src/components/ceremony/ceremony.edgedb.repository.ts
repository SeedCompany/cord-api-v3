import { Injectable } from '@nestjs/common';
import { NotImplementedException, PublicOf } from '~/common';
import { castToEnum, RepoFor } from '~/core/edgedb';
import { CeremonyRepository } from './ceremony.repository';
import { Ceremony, CeremonyType } from './dto';

@Injectable()
export class CeremonyEdgeDBRepository
  extends RepoFor(Ceremony, {
    hydrate: (ceremony) => ({
      ...ceremony['*'],
      engagement: true,
      type: castToEnum(ceremony.__type__.name.slice(12, -8), CeremonyType),
    }),
    omit: ['create'],
  })
  implements PublicOf<CeremonyRepository>
{
  async create(): Promise<never> {
    throw new NotImplementedException();
  }
}
