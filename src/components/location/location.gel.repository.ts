import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { type ID, type PublicOf, ServerException } from '~/common';
import type { ResourceNameLike } from '~/core';
import { e, RepoFor } from '~/core/gel';
import {
  type CreateLocation,
  Location,
  type LocationListInput,
  type UpdateLocation,
} from './dto';
import { type LocationRepository } from './location.repository';

@Injectable()
export class LocationGelRepository
  extends RepoFor(Location, {
    hydrate: (loc) => ({
      ...loc['*'],
      fundingAccount: true,
      defaultFieldRegion: true,
      mapImage: true,
      defaultMarketingRegion: true,
    }),
    omit: ['create', 'update'],
  })
  implements PublicOf<LocationRepository>
{
  async create(input: CreateLocation) {
    return await this.defaults.create({
      ...input,
      mapImage: undefined, // TODO
    });
  }

  async update(input: UpdateLocation) {
    return await this.defaults.update({
      ...input,
      mapImage: undefined, // TODO
    });
  }

  async addLocationToNode(
    label: ResourceNameLike,
    id: ID,
    rel: string,
    locationId: ID<'Location'>,
  ) {
    const location = e.cast(e.Location, e.cast(e.uuid, locationId));
    const res = this.resources.getByGel(label);
    const node = e.cast(res.db, e.cast(e.uuid, id));
    const edge = (node as any)[
      rel
    ] as unknown as typeof e.Project.otherLocations;

    const query = e.op(
      'if',
      e.op('not', e.op(location, 'in', edge)),
      'then',
      e.update(node, () => ({
        set: { [rel]: { '+=': location } },
      })),
      'else',
      e.cast(e.uuid, e.set()),
    );
    const updated = await this.db.run(query);
    return updated ? DateTime.now() : null;
  }

  async removeLocationFromNode(
    label: ResourceNameLike,
    id: ID,
    rel: string,
    locationId: ID<'Location'>,
  ) {
    const location = e.cast(e.Location, e.cast(e.uuid, locationId));

    const res = this.resources.getByGel(label);
    const node = e.cast(res.db, e.cast(e.uuid, id));
    const edge = (node as any)[
      rel
    ] as unknown as typeof e.Project.otherLocations;

    const query = e.op(
      'if',
      e.op(location, 'in', edge),
      'then',
      e.update(node, () => ({
        set: { [rel]: { '-=': location } },
      })),
      'else',
      e.cast(e.uuid, e.set()),
    );
    const updated = await this.db.run(query);
    return updated ? DateTime.now() : null;
  }

  async listLocationsFromNodeNoSecGroups(
    label: string,
    rel: string,
    id: ID,
    input: LocationListInput,
  ) {
    const res = this.resources.getByGel(label);
    const node = e.cast(res.db, e.cast(e.uuid, id));
    const locations = e.select(node)[
      rel as keyof typeof node
    ] as typeof e.Location;
    // Types may be misleading, confirm at runtime.
    /* eslint-disable @typescript-eslint/no-unnecessary-condition */
    if (!locations) {
      throw new ServerException(`${label} does not have a "${rel}" link`);
    }
    if (locations.__element__.__name__ !== 'default::Location') {
      throw new ServerException(`${label}.${rel} is not a link to Locations`);
    }
    /* eslint-enable  @typescript-eslint/no-unnecessary-condition */
    const all = e.select(locations, (obj) => ({
      ...this.applyFilter(obj, input),
      ...this.applyOrderBy(obj, input),
    }));
    return await this.paginateAndRun(all, input);
  }
}
