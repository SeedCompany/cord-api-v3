import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { CreatePartner, Partner } from './dto';
import { PartnerRepository } from './partner.repository';

@Injectable()
export class PartnerGelRepository
  extends RepoFor(Partner, {
    hydrate: (partner) => ({
      __typename: e.str('Partner'),
      ...partner['*'],
      organization: true,
      pointOfContact: true,
      languageOfWiderCommunication: true,
      fieldRegions: true,
      countries: true,
      languagesOfConsulting: true,
    }),
    omit: ['create'],
  })
  implements PublicOf<PartnerRepository>
{
  async create(input: CreatePartner) {
    const { organizationId, ...rest } = input;
    const organization = e.cast(e.Organization, e.uuid(organizationId));
    return await this.defaults.create({
      ...rest,
      organization,
      name: organization.name,
      projectContext: organization.projectContext,
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
