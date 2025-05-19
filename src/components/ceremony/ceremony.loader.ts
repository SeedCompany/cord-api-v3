import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { CeremonyService } from './ceremony.service';
import { Ceremony } from './dto';

@LoaderFactory(() => Ceremony)
export class CeremonyLoader
  implements DataLoaderStrategy<Ceremony, ID<Ceremony>>
{
  constructor(private readonly ceremonies: CeremonyService) {}

  async loadMany(ids: ReadonlyArray<ID<Ceremony>>) {
    return await this.ceremonies.readMany(ids);
  }
}
