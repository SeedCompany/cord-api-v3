import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Partner } from './dto';
import { PartnerService } from './partner.service';

@LoaderFactory(() => Partner)
export class PartnerLoader implements DataLoaderStrategy<Partner, ID<Partner>> {
  constructor(private readonly partners: PartnerService) {}

  async loadMany(ids: ReadonlyArray<ID<Partner>>) {
    return await this.partners.readMany(ids);
  }
}
