import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { FieldRegion } from './dto';
import { FieldRegionService } from './field-region.service';

@Injectable({ scope: Scope.REQUEST })
export class FieldRegionLoader extends OrderedNestDataLoader<FieldRegion> {
  constructor(private readonly fieldRegions: FieldRegionService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.fieldRegions.readMany(ids, this.session);
  }
}
