import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import { ProgressReport } from '../periodic-report/dto';
import { ProgressSummary } from './dto';

@Injectable()
export class ProgressSummaryRepository extends DtoRepository(ProgressSummary) {
  async readOne(
    reportId: ID,
    session: Session
  ): Promise<ProgressSummary | undefined> {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('', 'ProgressReport', { id: reportId }),
        relation('out', '', 'progressSummary', { active: true }),
        node('ps', 'ProgressSummary'),
      ])
      .return('ps as progressSummary')
      .asResult<ProgressSummary>()
      .first();
  }

  async save(report: ProgressReport, data: ProgressSummary) {
    const query = this.db.query();
    data
      ? query.merge([
          node('', 'ProgressReport', { id: report.id }),
          relation('out', '', 'progressSummary', { active: true }),
          node('', 'ProgressSummary', data),
        ])
      : query
          .match([
            node('', 'ProgressReport', { id: report.id }),
            relation('out', '', 'progressSummary', { active: true }),
            node('ps', 'ProgressSummary'),
          ])
          .detachDelete('ps');
    await query.run();
  }
}
