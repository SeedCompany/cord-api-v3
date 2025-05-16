import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { FieldZone } from './dto';
import { FieldZoneService } from './field-zone.service';

@LoaderFactory(() => FieldZone)
export class FieldZoneLoader
  implements DataLoaderStrategy<FieldZone, ID<FieldZone>>
{
  constructor(private readonly fieldZones: FieldZoneService) {}

  async loadMany(ids: ReadonlyArray<ID<FieldZone>>) {
    return await this.fieldZones.readMany(ids);
  }
}
