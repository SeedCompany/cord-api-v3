import { Injectable } from '@nestjs/common';
import { Range } from 'gel';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor, type ScopeOf } from '~/core/gel';
import {
  type CreateUnavailability,
  Unavailability,
  type UnavailabilityListInput,
  type UpdateUnavailability,
} from './dto';
import { type UnavailabilityRepository } from './unavailability.repository';

@Injectable()
export class UnavailabilityGelRepository
  extends RepoFor(Unavailability, {
    hydrate: (unavailability) => ({
      ...unavailability['*'],
    }),
    omit: ['create', 'update'],
  })
  implements PublicOf<UnavailabilityRepository>
{
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
      updatedUser: e.alias(updatedUser), // Attach to query, so it is executed.
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

  async getUserIdByUnavailability(id: ID) {
    const unavailability = e.cast(e.User.Unavailability, e.uuid(id));
    const query = e.assert_exists(
      e.select(e.User, (user) => ({
        filter_single: e.op(unavailability, 'in', user.unavailabilities),
      })),
    );
    return await this.db.run(query);
  }

  protected listFilters(
    unavailability: ScopeOf<typeof e.User.Unavailability>,
    { filter: input }: UnavailabilityListInput,
  ) {
    if (!input) return [];
    return [
      input.userId &&
        e.op(
          e.cast(e.User, e.uuid(input.userId)),
          'in',
          unavailability['<unavailabilities[is User]'],
        ),
    ];
  }
}
