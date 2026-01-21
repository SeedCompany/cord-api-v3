import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Unavailability } from './dto';
import { UnavailabilityService } from './unavailability.service';

@LoaderFactory(() => Unavailability)
export class UnavailabilityLoader implements DataLoaderStrategy<
  Unavailability,
  ID<Unavailability>
> {
  constructor(private readonly unavailabilities: UnavailabilityService) {}

  async loadMany(ids: ReadonlyArray<ID<Unavailability>>) {
    return await this.unavailabilities.readMany(ids);
  }
}
