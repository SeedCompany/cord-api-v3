import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { FieldRegion } from './dto';
import { FieldRegionRepository } from './field-region.repository';

@Injectable()
export class FieldRegionEdgeDBRepository
  extends RepoFor(FieldRegion, {
    hydrate: (region) => ({
      ...region['*'],
      director: true,
      fieldZone: true,
    }),
  })
  implements PublicOf<FieldRegionRepository> {}
