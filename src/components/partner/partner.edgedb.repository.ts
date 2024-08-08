import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { CreatePartner, Partner } from './dto';
import { PartnerRepository } from './partner.repository';

@Injectable()
export class PartnerEdgeDBRepository
  extends RepoFor(Partner, {
    hydrate: (partner) => ({
      ...partner['*'],
      organization: true,
      pointOfContact: true,
      languageOfWiderCommunication: true,
      fieldRegions: true,
      countries: true,
      languagesOfConsulting: true,
      __typename: partner.__type__.name.slice(9, null),
    }),
    omit: ['create'],
  })
  implements PublicOf<PartnerRepository>
{
  async create(input: CreatePartner) {
    const organization = e.cast(e.Organization, e.uuid(input.organizationId));
    return await this.defaults.create({
      name: organization.name,
      ...input,
    });
  }

  async partnerIdByOrg(organizationId: ID) {
    const organization = e.cast(e.Organization, e.uuid(organizationId));
    const partner = e.select(e.Partner, () => ({
      filter_single: { organization },
    }));
    return await this.db.run(partner.id);
  }
}
