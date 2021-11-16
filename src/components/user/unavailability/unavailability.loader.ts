import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../../common';
import { OrderedNestDataLoader } from '../../../core';
import { Unavailability } from './dto';
import { UnavailabilityService } from './unavailability.service';

@Injectable({ scope: Scope.REQUEST })
export class UnavailabilityLoader extends OrderedNestDataLoader<Unavailability> {
  constructor(private readonly unavailabilities: UnavailabilityService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.unavailabilities.readMany(ids, this.session);
  }
}
