import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { OtherPartnerContribution } from './dto';
import { OtherPartnerContributionService } from './other-partner-contribution.service';

@LoaderFactory(() => OtherPartnerContribution)
export class OtherPartnerContributionLoader implements DataLoaderStrategy<
  OtherPartnerContribution,
  ID<OtherPartnerContribution>
> {
  constructor(private readonly service: OtherPartnerContributionService) {}

  async loadMany(ids: ReadonlyArray<ID<OtherPartnerContribution>>) {
    return await this.service.readMany(ids);
  }
}
