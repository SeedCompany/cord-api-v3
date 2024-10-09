import { Injectable } from '@nestjs/common';
import { cleanJoin, isNotFalsy, mapValues, setOf } from '@seedcompany/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { ID } from '~/common';
import { CommonRepository } from '~/core/database';
import {
  ACTIVE,
  defineSorters,
  filter,
  listConcat,
  merge,
  SortCol,
} from '~/core/database/query';
import { WhereExp } from '~/core/database/query/where-and-list';
import { ProgressReport } from '../progress-report/dto';
import {
  FetchedSummaries,
  ProgressSummary,
  ProgressSummaryFilters,
  SummaryPeriod,
} from './dto';

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
          ]),
      )
      .optionalMatch([
        node('report'),
        relation('out', '', 'summary', ACTIVE),
        node('ps', 'ProgressSummary'),
      ])
      .with([
        'report',
        'totalVerses',
        'totalVerseEquivalents',
        'collect(apoc.map.fromValues([ps.period, apoc.convert.toMap(ps)])) as collected',
      ])
      .return<{ dto: FetchedSummaries }>(
        merge(
          listConcat('collected', {
            report: 'report { .id }',
            totalVerses: 'totalVerses',
            totalVerseEquivalents: 'totalVerseEquivalents',
          }),
        ).as('dto'),
      )
      .map('dto');
    return await query.run();
  }

  async save(
    report: ProgressReport,
    period: SummaryPeriod,
    data: ProgressSummary,
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

export const progressSummarySorters = defineSorters(ProgressSummary, {
  ...mapValues.fromList(
    ['variance', 'scheduleStatus'],
    () => (query: Query) =>
      query.return<SortCol>('(node.actual - node.planned) as sortValue'),
  ).asRecord,
});

export const progressSummaryFilters = filter.define(
  () => ProgressSummaryFilters,
  {
    scheduleStatus: ({ value, query }) => {
      const status = setOf(value);
      if (status.size === 0) {
        return undefined;
      }
      if (status.size === 1 && status.has(null)) {
        return query.where(new WhereExp('node IS NULL'));
      }

      const conditions = cleanJoin(' OR ', [
        status.has(null) && `node IS NULL`,
        status.has('Ahead') && `node.actual - node.planned > 0.1`,
        status.has('Behind') && `node.actual - node.planned < -0.1`,
        status.has('OnTime') &&
          `node.actual - node.planned <= 0.1 and node.actual - node.planned >= -0.1`,
      ]);
      const required = status.has(null) ? undefined : `node IS NOT NULL`;
      const str = [required, conditions]
        .filter(isNotFalsy)
        .map((s) => `(${s})`)
        .join(' AND ');
      return str ? query.where(new WhereExp(str)) : query;
    },
  },
);
