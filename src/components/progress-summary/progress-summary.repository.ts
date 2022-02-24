import { Injectable } from '@nestjs/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { ID } from '../../common';
import { CommonRepository } from '../../core';
import {
  ACTIVE,
  apoc,
  collect,
  listConcat,
  merge,
} from '../../core/database/query';
import { ProgressReport } from '../periodic-report/dto';
import { FetchedSummaries, ProgressSummary, SummaryPeriod } from './dto';

@Injectable()
export class ProgressSummaryRepository extends CommonRepository {
  async readMany(reportIds: readonly ID[]) {
    const query = this.db
      .query()
      .matchNode('report', 'ProgressReport')
      .where({ 'report.id': inArray(reportIds) })
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
      .optionalMatch([
        node('report'),
        relation('out', '', 'summary', ACTIVE),
        node('ps', 'ProgressSummary'),
      ])
      .return<{ dto: FetchedSummaries }>(
        merge(
          listConcat(
            // Convert rows of `ps` summaries to mapping keyed by their period
            collect(
              apoc.map.fromValues(['ps.period', apoc.convert.toMap('ps')])
            ),
            {
              reportId: 'report.id',
              totalVerses: 'totalVerses',
              totalVerseEquivalents: 'totalVerseEquivalents',
            }
          )
        ).as('dto')
      )
      .map('dto');
    return await query.run();
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
