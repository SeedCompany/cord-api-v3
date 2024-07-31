import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { Partnership } from './dto';
import type { PartnershipByProjectAndPartnerInput } from './partnership-by-project-and-partner.loader';
import { PartnershipRepository } from './partnership.repository';

@Injectable()
export class PartnershipEdgeDBRepository
  extends RepoFor(Partnership, {
    hydrate: (partnership) => ({
      ...partnership['*'],
      organization: true,
      project: true,
      partner: true,
      mou: true,
      agreement: true,
      parent: e.tuple({
        identity: partnership.project.id,
        labels: e.array_agg(
          e.set(partnership.project.__type__.name.slice(9, null)),
        ),
        properties: e.tuple({
          id: partnership.project.id,
          createdAt: partnership.project.createdAt,
        }),
      }),
    }),
  })
  implements PublicOf<PartnershipRepository>
{
  async readManyByProjectAndPartner(
    input: readonly PartnershipByProjectAndPartnerInput[],
  ) {
    const results = [];
    for (const item of input) {
      const project = e.cast(e.Project, e.uuid(item.project));
      const partner = e.cast(e.Partner, e.uuid(item.partner));

      const query = e.select(e.Partnership, (partnership) => ({
        ...this.hydrate(partnership),
        filter: e.op(
          e.op(partnership.project, '=', project),
          'and',
          e.op(partnership.partner, '=', partner),
        ),
      }));
      const result = await this.db.run(query);
      results.push(...result);
    }
    return results;
  }

  async isFirstPartnership(projectId: ID) {
    const project = e.cast(e.Project, e.uuid(projectId));
    const query = e.op('not', e.op('exists', project.partnerships));
    return await this.db.run(query);
  }

  async isAnyOtherPartnerships(id: ID) {
    const query = e.op('exists', this.matchOtherPartnerships(id));
    return await this.db.run(query);
  }

  async removePrimaryFromOtherPartnerships(id: ID) {
    const query = e.update(this.matchOtherPartnerships(id), () => ({
      set: { primary: false },
    }));
    await this.db.run(query);
  }

  private matchOtherPartnerships(id: ID) {
    const partnership = e.cast(e.Partnership, e.cast(e.uuid, id));
    return e.op(partnership.project.partnerships, 'except', partnership);
  }
}
