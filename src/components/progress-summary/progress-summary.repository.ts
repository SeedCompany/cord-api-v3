import { Injectable } from '@nestjs/common';
import { isNull, Node, node, relation } from 'cypher-query-builder';
import { ID } from '../../common';
import { DtoRepository } from '../../core';
import { ACTIVE } from '../../core/database/query';
import { ProgressReport } from '../periodic-report/dto';
import { ProgressSummary, SummaryPeriod } from './dto';

@Injectable()
export class ProgressSummaryRepository extends DtoRepository(ProgressSummary) {
  async readOne(
    reportId: ID,
    period: SummaryPeriod
  ): Promise<ProgressSummary | undefined> {
    const result = await this.db
      .query()
      .match([
        node('', 'ProgressReport', { id: reportId }),
        relation('out', '', 'summary', ACTIVE),
        node('ps', 'ProgressSummary'),
      ])
      .where({
        ps: [
          { period },
          // Handle BC with previous schema that only had cumulative without period specification
          ...(period === SummaryPeriod.Cumulative
            ? [{ period: isNull() }]
            : []),
        ],
      })
      .return<{ summary: Node<ProgressSummary> }>('ps as summary')
      .first();
    return result?.summary.properties;
  }

  async save(
    report: ProgressReport,
    period: SummaryPeriod,
    data: ProgressSummary
  ) {
    await this.db
      .query()
      .matchNode('pr', 'ProgressReport', { id: report.id })
      .merge([
        node('pr'),
        relation('out', '', 'summary', ACTIVE),
        node('summary', 'ProgressSummary', { period }),
      ])
      .setValues({ summary: { ...data, period } })
      .run();
  }
}
