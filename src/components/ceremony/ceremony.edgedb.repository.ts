import { Injectable } from '@nestjs/common';
import { NotImplementedException, PublicOf } from '~/common';
import { castToEnum, RepoFor } from '~/core/edgedb';
import { CeremonyRepository } from './ceremony.repository';
import { Ceremony, CeremonyType, CreateCeremony } from './dto';

@Injectable()
export class CeremonyEdgeDBRepository
  extends RepoFor(Ceremony, {
    hydrate: (ceremony) => ({
      ...ceremony['*'],
      engagement: true,
      type: castToEnum(ceremony.__type__.name.slice(12, -8), CeremonyType),
    }),
  }).withDefaults()
  implements PublicOf<CeremonyRepository>
{
  override create(input: CreateCeremony): never {
    throw new NotImplementedException();
  }
}
