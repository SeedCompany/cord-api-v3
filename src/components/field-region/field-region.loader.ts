import { ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { FieldRegion } from './dto';
import { FieldRegionService } from './field-region.service';

@LoaderFactory(() => FieldRegion)
export class FieldRegionLoader extends OrderedNestDataLoader<FieldRegion> {
  constructor(private readonly fieldRegions: FieldRegionService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.fieldRegions.readMany(ids, this.session);
  }
}
