import { Injectable } from '@nestjs/common';
import { Node } from 'cypher-query-builder';
import { ID, PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
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
  verifyRelationshipEligibility(
    projectId: ID,
    partnerId: ID,
    changeset?: ID | undefined,
  ): Promise<{
    partner?: Node | undefined;
    project?: Node | undefined;
    partnership?: Node | undefined;
  }> {
    throw new Error('Method not implemented.');
  }
  isFirstPartnership(
    projectId: ID,
    changeset?: ID | undefined,
  ): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  isAnyOtherPartnerships(id: ID): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  removePrimaryFromOtherPartnerships(id: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
