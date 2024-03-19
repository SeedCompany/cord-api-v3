import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { Partnership } from './dto';
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
  async isFirstPartnership(projectId: ID): Promise<boolean> {
    const query = e.select(e.Partnership, (partnership) => ({
      filter: e.op(partnership.project.id, '=', projectId),
    }));
    const partnership = await this.db.run(query);
    return !partnership;
  }

  async isAnyOtherPartnerships(id: ID): Promise<boolean> {
    const otherPartnerships = await this.matchOtherPartnerships(id);
    return otherPartnerships.length > 0;
  }

  async removePrimaryFromOtherPartnerships(id: ID): Promise<void> {
    const otherPartnershipIds = (await this.matchOtherPartnerships(id)).map(
      (obj) => obj.id,
    );

    const otherPartnerships = e.cast(
      e.Partnership,
      e.cast(e.uuid, e.set(...otherPartnershipIds)),
    );

    const query = e.update(otherPartnerships, () => ({
      set: {
        primary: false,
      },
    }));

    await this.db.run(query);
  }

  private matchOtherPartnerships(id: ID) {
    const currentPartnership = e.cast(e.Partnership, e.cast(e.uuid, id));
    const query = e.select(e.Partnership, (partnership) => ({
      filter:
        e.op(partnership.project.id, '=', currentPartnership.project.id) &&
        e.op(partnership.id, '!=', currentPartnership.id),
    }));

    return this.db.run(query);
  }
}
