import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Location } from './dto';
import { LocationService } from './location.service';

@Injectable({ scope: Scope.REQUEST })
export class LocationLoader extends OrderedNestDataLoader<Location> {
  constructor(private readonly locations: LocationService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.locations.readMany(ids, this.session);
  }
}
