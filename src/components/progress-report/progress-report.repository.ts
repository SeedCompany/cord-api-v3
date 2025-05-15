import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { type Session, type UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  filter,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  sortWith,
  variable,
} from '~/core/database/query';
import { engagementFilters } from '../engagement/engagement.repository';
import { progressReportSorters } from '../periodic-report/periodic-report.repository';
import { pnpExtractionResultFilters } from '../pnp/extraction-result/pnp-extraction-result.neo4j.repository';
import { SummaryPeriod } from '../progress-summary/dto';
import { progressSummaryFilters } from '../progress-summary/progress-summary.repository';
import {
  ProgressReport,
  ProgressReportFilters,
  type ProgressReportListInput,
} from './dto';
import { ProgressReportExtraForPeriodicInterfaceRepository } from './progress-report-extra-for-periodic-interface.repository';

@Injectable()
export class ProgressReportRepository extends DtoRepository<
  typeof ProgressReport,
  [session: Session]
>(ProgressReport) {
  constructor(
    private readonly extraRepo: ProgressReportExtraForPeriodicInterfaceRepository,
  ) {
    super();
  }

  async list(input: ProgressReportListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        node('node', 'ProgressReport'),
        relation('in', '', 'report'),
        node('', 'LanguageEngagement'),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
      ])
      .apply(progressReportFilters(input.filter))
      .apply(
        this.privileges.filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sortWith(progressReportSorters, input))
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .match([
          node('node'),
          relation('in', '', 'report', ACTIVE),
          node('parent', 'LanguageEngagement'),
          relation('in', '', 'engagement', ACTIVE),
          node('project', 'Project'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles())
        .subQuery('node', this.extraRepo.extraHydrate())
        .return<{ dto: UnsecuredDto<ProgressReport> }>(
          merge('props', { parent: 'parent' }, 'extra').as('dto'),
        );
  }
}

export const progressReportFilters = filter.define(
  () => ProgressReportFilters,
  {
    parent: filter.pathExists((id) => [
      node('', 'BaseNode', { id }),
      relation('out', '', 'report', ACTIVE),
      node('node'),
    ]),
    start: filter.dateTimeProp(),
    end: filter.dateTimeProp(),
    status: filter.stringListProp(),
    cumulativeSummary: filter.sub(() => progressSummaryFilters)((sub) =>
      sub
        .optionalMatch([
          node('outer'),
          relation('out', '', 'summary', ACTIVE),
          node('node', 'ProgressSummary', {
            period: variable(`"${SummaryPeriod.Cumulative}"`),
          }),
        ])
        // needed in conjunction with `optionalMatch`
        .with('outer, node'),
    ),
    engagement: filter.sub(() => engagementFilters)((sub) =>
      sub.match([
        node('outer'),
        relation('in', '', 'report'),
        node('node', 'Engagement'),
      ]),
    ),
    pnpExtractionResult: filter.sub(() => pnpExtractionResultFilters)((sub) =>
      sub.match([
        node('outer'),
        relation('out', '', 'reportFileNode'),
        node('file', 'File'),
        relation('out', '', 'pnpExtractionResult'),
        node('node', 'PnpExtractionResult'),
      ]),
    ),
  },
);
