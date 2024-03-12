import { Injectable } from '@nestjs/common';
import {
  ID,
  NotImplementedException,
  PaginatedListType,
  PublicOf,
  UnsecuredDto,
} from '~/common';
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

  listLocationsFromNodeNoSecGroups(
    label: string,
    rel: string,
    id: ID,
    input: LocationListInput,
  ): Promise<PaginatedListType<UnsecuredDto<Location>>> {
    throw new NotImplementedException().with(label, id, rel, input);
  }
}
