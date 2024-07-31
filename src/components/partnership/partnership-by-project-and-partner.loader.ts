import {
  LoaderFactory,
  LoaderOptionsOf,
  SessionAwareLoaderStrategy,
} from '~/core';
import { Partnership, PartnershipByProjectAndPartnerInput } from './dto';
import { PartnershipService } from './partnership.service';

@LoaderFactory()
export class PartnershipByProjectAndPartnerLoader extends SessionAwareLoaderStrategy<
  { input: PartnershipByProjectAndPartnerInput; partnership: Partnership },
  PartnershipByProjectAndPartnerInput,
  string
> {
  constructor(private readonly service: PartnershipService) {
    super();
  }

  getOptions() {
    return {
      propertyKey: (x) => x.input,
      cacheKeyFn: (partnership) =>
        `${partnership.project.id}:${partnership.partner.id}`,
    } satisfies LoaderOptionsOf<PartnershipByProjectAndPartnerLoader>;
  }

  async loadMany(input: readonly PartnershipByProjectAndPartnerInput[]) {
    const partnerships = await this.service.loadPartnershipByProjectAndPartner(
      input,
      this.session,
    );
    return partnerships;
  }
}
