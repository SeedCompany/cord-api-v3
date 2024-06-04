import { ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { Unavailability } from './dto';
import { UnavailabilityService } from './unavailability.service';

@LoaderFactory(() => Unavailability)
export class UnavailabilityLoader extends OrderedNestDataLoader<Unavailability> {
  constructor(private readonly unavailabilities: UnavailabilityService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.unavailabilities.readMany(ids, this.session);
  }
}
