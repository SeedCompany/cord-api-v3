import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { Partner } from './dto';
import { PartnerService } from './partner.service';

@LoaderFactory(() => Partner)
export class PartnerLoader extends OrderedNestDataLoader<Partner> {
  constructor(private readonly partners: PartnerService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.partners.readMany(ids, this.session);
  }
}
