import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { AllianceMembershipService } from './alliance-membership.service';
import { AllianceMembership } from './dto';

@LoaderFactory(() => AllianceMembership)
export class AllianceMembershipLoader
  implements DataLoaderStrategy<AllianceMembership, ID<AllianceMembership>>
{
  constructor(
    private readonly allianceMemberships: AllianceMembershipService,
  ) {}

  async loadMany(ids: ReadonlyArray<ID<AllianceMembership>>) {
    return await this.allianceMemberships.readMany(ids);
  }
}
