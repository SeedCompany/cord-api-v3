import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { FieldRegion } from './dto';
import { FieldRegionService } from './field-region.service';

@LoaderFactory(() => FieldRegion)
export class FieldRegionLoader implements DataLoaderStrategy<FieldRegion, ID<FieldRegion>> {
  constructor(private readonly fieldRegions: FieldRegionService) {}

  async loadMany(ids: ReadonlyArray<ID<FieldRegion>>) {
    return await this.fieldRegions.readMany(ids);
  }
}
