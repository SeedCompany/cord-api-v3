import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { FieldZone } from './dto';
import { FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class FieldZoneEdgeDBRepository
  extends RepoFor(FieldZone, {
    hydrate: (zone) => ({
      ...zone['*'],
      director: true,
    }),
  }).withDefaults()
  implements PublicOf<FieldZoneRepository> {}
