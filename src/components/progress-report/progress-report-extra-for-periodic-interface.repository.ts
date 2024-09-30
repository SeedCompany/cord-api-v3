import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  CreateNodeOptions,
  DefinedSorters,
  defineSorters,
  exp,
  QueryFragment,
  SortFieldOf,
  sortWith,
} from '~/core/database/query';
import { engagementSorters } from '../engagement/engagement.repository';
import { MergePeriodicReports } from '../periodic-report/dto';
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
  'engagement.*': (query, input) =>
    query
      .with('node as report')
      .match([
        node('report'),
        relation('in', '', 'report'),
        node('node', 'LanguageEngagement'),
      ])
      .apply(sortWith(engagementSorters, input)),
});
