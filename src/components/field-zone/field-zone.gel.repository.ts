import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/gel';
import { FieldZone } from './dto';
import { FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class FieldZoneGelRepository
  extends RepoFor(FieldZone, {
    hydrate: (zone) => ({
      ...zone['*'],
      director: true,
    }),
  })
  implements PublicOf<FieldZoneRepository> {}
