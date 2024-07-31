import { ID } from '~/common';
import {
  LoaderFactory,
  LoaderOptionsOf,
  SessionAwareLoaderStrategy,
} from '~/core';
import { Partnership } from './dto';
import { PartnershipService } from './partnership.service';

export interface PartnershipByProjectAndPartnerInput {
  project: ID<'Project'>;
  partner: ID<'Partner'>;
}

@LoaderFactory()
export class PartnershipByProjectAndPartnerLoader extends SessionAwareLoaderStrategy<
  { id: PartnershipByProjectAndPartnerInput; partnership: Partnership },
  PartnershipByProjectAndPartnerInput,
  string
> {
  constructor(private readonly service: PartnershipService) {
    super();
  }

  getOptions() {
    return {
      cacheKeyFn: (input) => `${input.project}:${input.partner}`,
    } satisfies LoaderOptionsOf<PartnershipByProjectAndPartnerLoader>;
  }

  async loadMany(input: readonly PartnershipByProjectAndPartnerInput[]) {
    return await this.service.readManyByProjectAndPartner(input, this.session);
  }
}
