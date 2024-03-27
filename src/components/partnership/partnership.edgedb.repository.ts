import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { Partnership } from './dto';
import { PartnershipRepository } from './partnership.repository';

@Injectable()
export class PartnershipEdgeDBRepository
  extends RepoFor(Partnership, {
    hydrate: (p) => ({
      ...p['*'],
      organization: true,
      project: true,
      partner: true,
      mou: true,
      agreement: true,
      parent: true,
      scope: true,
    }),
  }).withDefaults()
  implements PublicOf<PartnershipRepository>
{
  async isFirstPartnership(
    projectId: ID,
    _changeset?: ID | undefined,
  ): Promise<boolean> {
    const query = e.select(e.Partnership, (partnership) => ({
      filter: e.op(partnership.project.id, '=', projectId),
    }));
    const partnership = await this.db.run(query);
    return !partnership;
  }
  isAnyOtherPartnerships(id: ID): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  removePrimaryFromOtherPartnerships(id: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
