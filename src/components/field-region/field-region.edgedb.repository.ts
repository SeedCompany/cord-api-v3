import { Injectable } from '@nestjs/common';
import { PublicOf } from '../../common';
import { ChangesOf } from '../../core/database/changes';
import { e, RepoFor } from '../../core/edgedb';
import { CreateFieldRegion, FieldRegion, UpdateFieldRegion } from './dto';
import { FieldRegionRepository } from './field-region.repository';

@Injectable()
export class FieldRegionEdgeDBRepository
  extends RepoFor(FieldRegion, {
    hydrate: (region) => ({
      ...region['*'],
      director: true,
      fieldZone: true,
    }),
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreateFieldRegion) {
        const created = e.insert(e.FieldRegion, {
          name: input.name,
          director: e.cast(e.User, e.cast(e.uuid, input.directorId)),
          fieldZone: e.cast(e.FieldZone, e.cast(e.uuid, input.fieldZoneId)),
        });
        const query = e.select(created, this.hydrate);
        return await this.db.run(query);
      }

      async update(
        { id }: Pick<FieldRegion, 'id'>,
        changes: ChangesOf<FieldRegion, UpdateFieldRegion>,
      ) {
        const region = e.cast(e.FieldRegion, e.cast(e.uuid, id));
        const updated = e.update(region, () => ({
          set: {
            ...(changes.name && { name: changes.name }),
            ...(changes.directorId && {
              director: e.cast(e.User, e.cast(e.uuid, changes.directorId)),
            }),
            ...(changes.fieldZoneId && {
              fieldZone: e.cast(
                e.FieldZone,
                e.cast(e.uuid, changes.fieldZoneId),
              ),
            }),
          },
        }));
        const query = e.select(updated, this.hydrate);
        return await this.db.run(query);
      }
    };
  })
  implements PublicOf<FieldRegionRepository> {}
