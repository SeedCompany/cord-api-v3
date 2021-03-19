import { Injectable } from '@nestjs/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { DatabaseService } from '../../core';
import { OngoingEngagementStatuses } from './dto';

@Injectable()
export class EngagementRepository {
  constructor(private readonly db: DatabaseService) {}

  async getOngoingEngagementIds(projectId: string) {
    const rows = await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', { active: true }),
        node('engagement'),
        relation('out', '', 'status', { active: true }),
        node('sn', 'Property'),
      ])
      .where({
        sn: {
          value: inArray(OngoingEngagementStatuses),
        },
      })
      .return('engagement.id as id')
      .asResult<{ id: string }>()
      .run();
    return rows.map((r) => r.id);
  }
}
