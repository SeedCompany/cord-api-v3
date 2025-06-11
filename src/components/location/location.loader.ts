import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Location } from './dto';
import { LocationService } from './location.service';

@LoaderFactory(() => Location)
export class LocationLoader implements DataLoaderStrategy<Location, ID<Location>> {
  constructor(private readonly locations: LocationService) {}

  async loadMany(ids: ReadonlyArray<ID<Location>>) {
    return await this.locations.readMany(ids);
  }
}
