import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { ChangesOf } from '~/core/database/changes';
import { e, RepoFor } from '~/core/edgedb';
import { CreateFieldZone, FieldZone, UpdateFieldZone } from './dto';
import { FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class FieldZoneEdgeDBRepository
  extends RepoFor(FieldZone, {
    hydrate: (zone) => ({
      ...zone['*'],
      director: true,
    }),
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreateFieldZone) {
        const created = e.insert(e.FieldZone, {
          name: input.name,
          director: e.cast(e.User, e.cast(e.uuid, input.directorId)),
        });
        const query = e.select(created, this.hydrate);
        return await this.db.run(query);
      }

      async update(
        { id }: Pick<FieldZone, 'id'>,
        changes: ChangesOf<FieldZone, UpdateFieldZone>,
      ) {
        const zone = e.cast(e.FieldZone, e.cast(e.uuid, id));
        const updated = e.update(zone, () => ({
          set: {
            ...(changes.name && { name: changes.name }),
            ...(changes.directorId && {
              director: e.cast(e.User, e.cast(e.uuid, changes.directorId)),
            }),
          },
        }));
        const query = e.select(updated, this.hydrate);
        return await this.db.run(query);
      }
    };
  })
  implements PublicOf<FieldZoneRepository> {}
