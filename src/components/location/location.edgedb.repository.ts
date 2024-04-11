import { Injectable } from '@nestjs/common';
import { ID, PublicOf, ServerException } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { Location, LocationListInput } from './dto';
import { LocationRepository } from './location.repository';

@Injectable()
export class LocationEdgeDBRepository
  extends RepoFor(Location, {
    hydrate: (loc) => ({
      ...loc['*'],
      fundingAccount: true,
      defaultFieldRegion: true,
      mapImage: true,
      defaultMarketingRegion: true,
    }),
  }).withDefaults()
  implements PublicOf<LocationRepository>
{
  async addLocationToNode(label: string, id: ID, rel: string, locationId: ID) {
    const res = this.resources.getByEdgeDB(label);
    const node = e.cast(res.db, e.cast(e.uuid, id));
    const location = e.cast(e.Location, e.cast(e.uuid, locationId));
    const query = e.update(node, () => ({
      set: {
        [rel]: { '+=': location },
      },
    }));
    await this.db.run(query);
  }

  async removeLocationFromNode(
    label: string,
    id: ID,
    rel: string,
    locationId: ID,
  ) {
    const res = this.resources.getByEdgeDB(label);
    const node = e.cast(res.db, e.cast(e.uuid, id));
    const location = e.cast(e.Location, e.cast(e.uuid, locationId));
    const query = e.update(node, () => ({
      set: {
        [rel]: { '-=': location },
      },
    }));
    await this.db.run(query);
  }

  async listLocationsFromNodeNoSecGroups(
    label: string,
    rel: string,
    id: ID,
    input: LocationListInput,
  ) {
    const res = this.resources.getByEdgeDB(label);
    const node = e.cast(res.db, e.cast(e.uuid, id));
    const locations = e.select(node)[
      rel as keyof typeof node
    ] as typeof e.Location;
    if (!locations) {
      throw new ServerException(`${label} does not have a "${rel}" link`);
    }
    if (locations.__element__.__name__ !== 'default::Location') {
      throw new ServerException(`${label}.${rel} is not a link to Locations`);
    }
    const all = e.select(locations, (obj) => ({
      ...this.applyFilter(obj, input),
      ...this.applyOrderBy(obj, input),
    }));
    return await this.paginate(all, input);
  }
}
