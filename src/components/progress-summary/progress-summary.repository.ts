import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID } from '../../common';
import { DtoRepository } from '../../core';
import { ACTIVE, merge } from '../../core/database/query';
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
        node('report', 'ProgressReport', { id: reportId }),
        relation('out', '', 'summary', ACTIVE),
        node('ps', 'ProgressSummary', { period }),
      ])
      .subQuery('report', (sub) =>
        sub
          .match([
            [
              node('report'),
              relation('in', '', 'report', ACTIVE),
              node('eng', 'Engagement'),
              relation('out', '', 'product', ACTIVE),
              node('product', 'Product'),
            ],
            [
              node('product'),
              relation('out', '', 'totalVerses', ACTIVE),
              node('tv', 'Property'),
            ],
            [
              node('product'),
              relation('out', '', 'totalVerseEquivalents', ACTIVE),
              node('tve', 'Property'),
            ],
          ])
          .return([
            'sum(tv.value) as totalVerses',
            'sum(tve.value) as totalVerseEquivalents',
          ])
      )
      .return<{ dto: ProgressSummary }>(
        merge('ps', {
          totalVerses: 'totalVerses',
          totalVerseEquivalents: 'totalVerseEquivalents',
        }).as('dto')
      )
      .first();
    return result?.dto;
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
