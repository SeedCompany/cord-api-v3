import { Injectable } from '@nestjs/common';
import { mapEntries } from '@seedcompany/common';
import { node, not, relation } from 'cypher-query-builder';
import {
  CreateNodeOptions,
  DefinedSorters,
  defineSorters,
  exp,
  path,
  QueryFragment,
  SortCol,
  SortFieldOf,
  SortMatcher,
  sortWith,
  variable,
} from '~/core/database/query';
import { engagementSorters } from '../engagement/engagement.repository';
import { MergePeriodicReports } from '../periodic-report/dto';
import { pnpExtractionResultSorters } from '../pnp/extraction-result/pnp-extraction-result.neo4j.repository';
import { SummaryPeriod } from '../progress-summary/dto';
import { progressSummarySorters } from '../progress-summary/progress-summary.repository';
import { ProgressReport, ProgressReportStatus as Status } from './dto';

@Injectable()
export class ProgressReportExtraForPeriodicInterfaceRepository {
  getCreateOptions(
    _input: MergePeriodicReports,
  ): CreateNodeOptions<typeof ProgressReport> {
    return {
      initialProps: {
        status: Status.NotStarted,
      },
    };
  }

  amendAfterCreateNode(): QueryFragment {
    return (query) => query;
  }

  extraHydrate(): QueryFragment {
    return (query) =>
      query.return(
        exp({
          __typename: '"ProgressReport"',
        }).as('extra'),
      );
  }
}

export const progressReportExtrasSorters: DefinedSorters<
  SortFieldOf<typeof ProgressReport>
> = defineSorters(ProgressReport, {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'pnpExtractionResult.*': (query, input) =>
    query
      .with('node as report')
      .match([
        node('report'),
        relation('out', '', 'reportFileNode'),
        node('file', 'File'),
        relation('out', '', 'pnpExtractionResult'),
        node('node', 'PnpExtractionResult'),
      ])
      .apply(sortWith(pnpExtractionResultSorters, input)),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'engagement.*': (query, input) =>
    query
      .with('node as report')
      .match([
        node('report'),
        relation('in', '', 'report'),
        node('node', 'LanguageEngagement'),
      ])
      .apply(sortWith(engagementSorters, input)),
  ...mapEntries(
    [
      { field: 'cumulativeSummary', period: SummaryPeriod.Cumulative },
      { field: 'fiscalYearSummary', period: SummaryPeriod.FiscalYearSoFar },
      { field: 'periodSummary', period: SummaryPeriod.ReportPeriod },
    ],
    ({ field, period }) => {
      const periodVar = { period: variable(`"${period}"`) };
      const matcher: SortMatcher<string> = (query, input) =>
        query
          .with('node as report')
          .match([
            node('report'),
            relation('out', '', 'summary'),
            node('node', 'ProgressSummary', periodVar),
          ])
          .apply(sortWith(progressSummarySorters, input))
          .union()
          .with('node')
          .with('node as report')
          .where(
            not(
              path([
                node('report'),
                relation('out', '', 'summary'),
                node('', 'ProgressSummary', periodVar),
              ]),
            ),
          )
          .return<SortCol>('null as sortValue');
      return [`${field}.*`, matcher];
    },
  ).asRecord,
});
