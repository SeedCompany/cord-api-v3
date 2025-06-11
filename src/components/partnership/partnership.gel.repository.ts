import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { Partnership } from './dto';
import type { PartnershipByProjectAndPartnerInput } from './partnership-by-project-and-partner.loader';
import { type PartnershipRepository } from './partnership.repository';

@Injectable()
export class PartnershipGelRepository
  extends RepoFor(Partnership, {
    hydrate: (partnership) => ({
      ...partnership['*'],
      organization: true,
      project: true,
      partner: true,
      mou: true,
      agreement: true,
      parent: e.select({
        identity: partnership.project.id,
        labels: e.array_agg(e.set(partnership.project.__type__.name.slice(9, null))),
        properties: e.select({
          id: partnership.project.id,
          createdAt: partnership.project.createdAt,
        }),
      }),
    }),
  })
  implements PublicOf<PartnershipRepository>
{
  async readManyByProjectAndPartner(input: readonly PartnershipByProjectAndPartnerInput[]) {
    return await this.db.run(this.readManyByProjectAndPartnerQuery, { input });
  }
  private readonly readManyByProjectAndPartnerQuery = e.params(
    { input: e.array(e.tuple({ project: e.uuid, partner: e.uuid })) },
    ({ input }) =>
      e.select(e.Partnership, (partnership) => ({
        ...this.hydrate(partnership),
        filter: e.op(
          e.tuple({
            project: partnership.project.id,
            partner: partnership.partner.id,
          }),
          'in',
          e.array_unpack(input),
        ),
      })),
  );

  async listAllByProjectId(project: ID) {
    return await this.db.run(this.listAllByProjectIdQuery, { project });
  }
  private readonly listAllByProjectIdQuery = e.params({ project: e.uuid }, ($) =>
    e.select(e.cast(e.Project, $.project).partnerships, this.hydrate),
  );

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
