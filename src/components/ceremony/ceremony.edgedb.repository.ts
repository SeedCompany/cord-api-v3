import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
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
  }).withDefaults()
  implements PublicOf<CeremonyRepository>
{
  override create() {
    // nothing needed here
  }
}
