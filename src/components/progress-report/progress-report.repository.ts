import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Session, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  filter,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  sortWith,
} from '~/core/database/query';
import { progressReportSorters } from '../periodic-report/periodic-report.repository';
import {
  ProgressReport,
  ProgressReportFilters,
  ProgressReportListInput,
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
        this.privileges.forUser(session).filterToReadable({
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
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
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
  },
);
