import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Fields, IsOnlyId } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { PeriodicReportLoader } from '../periodic-report';
import { ProgressReport } from '../progress-report/dto';
import { Outcome, OutcomeHistory } from './dto';
import { OutcomeLoader } from './outcome.loader';

@Resolver(OutcomeHistory)
export class OutcomesHistoryResolver {
  @ResolveField(() => ProgressReport)
  async report(
    @Parent() history: OutcomeHistory,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
    @Info(Fields, IsOnlyId) isOnlyId: boolean,
  ) {
    const node = {
      __typename: 'ProgressReport',
      id: history.report,
    } as const;

    if (isOnlyId) {
      return node;
    }

    return (await reports.load(history.report)) as ProgressReport;
  }

  @ResolveField(() => Outcome)
  async outcome(
    @Parent() history: OutcomeHistory,
    @Loader(OutcomeLoader) reports: LoaderOf<OutcomeLoader>,
    @Info(Fields, IsOnlyId) isOnlyId: boolean,
  ) {
    const node = {
      __typename: 'Outcome',
      id: history.outcome,
    } as const;

    if (isOnlyId) {
      return node;
    }

    return await reports.load(history.outcome);
  }
}
