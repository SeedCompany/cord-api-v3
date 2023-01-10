import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, LoggedInSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import {
  ScheduleStatus,
  fromVariance as scheduleStatusFromVariance,
} from '../../progress-summary/dto/schedule-status.enum';
import { ProgressSummaryLoader } from '../../progress-summary/progress-summary.loader';
import { ProgressReport } from '../dto';
import { ProgressReportVarianceExplanationReasonOptions as ReasonOptions } from './reason-options';
import {
  ProgressReportVarianceExplanation,
  ProgressReportVarianceExplanationInput,
  ProgressReportVarianceExplanation as VarianceExplanation,
} from './variance-explanation.dto';
import { ProgressReportVarianceExplanationLoader } from './variance-explanation.loader';
import { ProgressReportVarianceExplanationService } from './variance-explanation.service';

@Resolver(ProgressReport)
export class ProgressReportVarianceExplanationResolver {
  constructor(
    private readonly service: ProgressReportVarianceExplanationService
  ) {}

  @ResolveField(() => VarianceExplanation)
  async varianceExplanation(
    @AnonSession() session: Session,
    @Parent() report: ProgressReport,
    @Loader(() => ProgressReportVarianceExplanationLoader)
    loader: LoaderOf<ProgressReportVarianceExplanationLoader>
  ): Promise<ProgressReportVarianceExplanation> {
    return await loader.load(report);
  }

  @Mutation(() => ProgressReport)
  async explainProgressVariance(
    @Args({ name: 'input' }) input: ProgressReportVarianceExplanationInput,
    @LoggedInSession() session: Session
  ): Promise<ProgressReport> {
    return await this.service.update(input, session);
  }
}

@Resolver(VarianceExplanation)
export class ProgressReportVarianceExplanationReasonOptionsResolver {
  @ResolveField(() => ReasonOptions)
  async reasonOptions(): Promise<ReasonOptions> {
    return ReasonOptions.instance;
  }

  @ResolveField(() => ScheduleStatus, {
    description:
      'Based on the cumulative variance. Here to be helpful since it goes hand in hand with this explanation',
    nullable: true,
  })
  async scheduleStatus(
    @Parent() self: VarianceExplanation,
    @Loader(ProgressSummaryLoader)
    summaryLoader: LoaderOf<ProgressSummaryLoader>
  ): Promise<ScheduleStatus | null> {
    const summaries = await summaryLoader.load(self.report.id);
    const summary = summaries.Cumulative;
    if (!summary) {
      return null;
    }
    const variance = summary.actual - summary.planned;
    return scheduleStatusFromVariance(variance);
  }
}
