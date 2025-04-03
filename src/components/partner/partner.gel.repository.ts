import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import * as departmentIdBlock from '../finance/department/gel.utils';
import { CreatePartner, Partner, UpdatePartner } from './dto';
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
      departmentIdBlock: departmentIdBlock.hydrate,
    }),
    omit: ['create', 'update'],
  })
  implements PublicOf<PartnerRepository>
{
  async create(input: CreatePartner) {
    const { organizationId, ...rest } = input;
    const organization = e.cast(e.Organization, e.uuid(organizationId));
    return await this.defaults.create({
      ...rest,
      departmentIdBlock: departmentIdBlock.insertMaybe(input.departmentIdBlock),
      organization,
      name: organization.name,
      projectContext: organization.projectContext,
    });
  }

  async update(input: UpdatePartner) {
    const partner = e.cast(e.Partner, e.uuid(input.id));
    return await this.defaults.update({
      ...input,
      departmentIdBlock: departmentIdBlock.setMaybe(
        partner.departmentIdBlock,
        input.departmentIdBlock,
      ),
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
