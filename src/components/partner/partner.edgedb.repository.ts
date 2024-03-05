import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { Partner } from './dto';
import { PartnerRepository } from './partner.repository';

@Injectable()
export class PartnerEdgeDBRepository
  extends RepoFor(Partner, {
    hydrate: (p) => ({
      ...p['*'],
      sensitivity: true,
      organization: true,
      pointOfContact: true,
      languageOfWiderCommunication: true,
      fieldRegions: true,
      countries: true,
      languagesOfConsulting: true,
      scope: true,
      pinned: true,
    }),
  }).withDefaults()
  implements PublicOf<PartnerRepository>
{
  async partnerIdByOrg(organizationId: ID) {
    const organization = e.select(e.Organization, () => ({
      filter_single: { id: organizationId },
    }));
    const partner = e.select(e.Partner, () => ({
      filter_single: { organization },
    }));
    const result = await this.db.run(partner);
    return result?.id ?? undefined;
  }
}
