import { Injectable } from '@nestjs/common';
import { Range } from 'edgedb';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import {
  CreateUnavailability,
  Unavailability,
  UpdateUnavailability,
} from './dto';
import { UnavailabilityRepository } from './unavailability.repository';

@Injectable()
export class UnavailabilityEdgeDBRepository
  extends RepoFor(Unavailability, {
    hydrate: (unavailability) => ({
      ...unavailability['*'],
    }),
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreateUnavailability) {
        const user = e.cast(e.User, e.uuid(input.userId));
        const inserted = e.insert(e.User.Unavailability, {
          description: input.description,
          dates: new Range(input.start, input.end),
        });
        const updatedUser = e.update(user, () => ({
          set: {
            unavailabilities: { '+=': inserted },
          },
        }));
        const query = e.select(inserted, (u) => ({
          ...this.hydrate(u),
          updatedUser, // Attach to query, so it is executed.
        }));
        return await this.db.run(query);
      }

      async update(input: UpdateUnavailability) {
        const unavailability = e.cast(e.User.Unavailability, e.uuid(input.id));
        const updated = e.update(unavailability, () => ({
          set: {
            description: input.description,
            dates: e.cast(
              e.range(e.datetime),
              e.range(
                input.start ?? e.range_get_lower(unavailability.dates),
                input.end ?? e.range_get_upper(unavailability.dates),
              ),
            ),
          },
        }));
        const query = e.select(updated, this.hydrate);
        return await this.db.run(query);
      }
    };
  })
  implements PublicOf<UnavailabilityRepository>
{
  async getUserIdByUnavailability(id: ID) {
    const unavailability = e.cast(e.User.Unavailability, e.uuid(id));
    const query = e.assert_exists(
      e.select(e.User, (user) => ({
        filter_single: e.op(unavailability, 'in', user.unavailabilities),
      })),
    );
    return await this.db.run(query);
  }
}
