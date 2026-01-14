import { type ID } from '~/common';
import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { type Partnership } from './dto';
import { PartnershipService } from './partnership.service';

export interface PartnershipByProjectAndPartnerInput {
  project: ID<'Project'>;
  partner: ID<'Partner'>;
}

@LoaderFactory()
export class PartnershipByProjectAndPartnerLoader implements DataLoaderStrategy<
  { id: PartnershipByProjectAndPartnerInput; partnership: Partnership },
  PartnershipByProjectAndPartnerInput,
  string
> {
  constructor(private readonly service: PartnershipService) {}

  getOptions() {
    return {
      cacheKeyFn: (input) => `${input.project}:${input.partner}`,
    } satisfies LoaderOptionsOf<PartnershipByProjectAndPartnerLoader>;
  }

  async loadMany(input: readonly PartnershipByProjectAndPartnerInput[]) {
    return await this.service.readManyByProjectAndPartner(input);
  }
}
