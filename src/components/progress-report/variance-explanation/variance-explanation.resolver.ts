import { Args, Mutation, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { clamp } from 'lodash';
import { Loader, type LoaderOf } from '~/core';
import { ScheduleStatus } from '../../progress-summary/dto';
import { ProgressSummaryLoader } from '../../progress-summary/progress-summary.loader';
import { ProgressReport } from '../dto';
import { ProgressReportVarianceExplanationReasonOptions as ReasonOptions } from './reason-options';
import {
  type ProgressReportVarianceExplanation,
  ProgressReportVarianceExplanationInput,
  ProgressReportVarianceExplanation as VarianceExplanation,
} from './variance-explanation.dto';
import { ProgressReportVarianceExplanationLoader } from './variance-explanation.loader';
import { ProgressReportVarianceExplanationService } from './variance-explanation.service';

@Resolver(ProgressReport)
export class ProgressReportVarianceExplanationResolver {
  constructor(private readonly service: ProgressReportVarianceExplanationService) {}

  @ResolveField(() => VarianceExplanation)
  async varianceExplanation(
    @Parent() report: ProgressReport,
    @Loader(() => ProgressReportVarianceExplanationLoader)
    loader: LoaderOf<ProgressReportVarianceExplanationLoader>,
  ): Promise<ProgressReportVarianceExplanation> {
    return await loader.load(report);
  }

  @Mutation(() => ProgressReport)
  async explainProgressVariance(
    @Args({ name: 'input' }) input: ProgressReportVarianceExplanationInput,
  ): Promise<ProgressReport> {
    return await this.service.update(input);
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
    summaryLoader: LoaderOf<ProgressSummaryLoader>,
  ): Promise<ScheduleStatus | null> {
    const reason = self.reasons.value[0];
    if (reason) {
      const { ahead, behind, onTime } = ReasonOptions.instance;
      if (ahead.has(reason)) {
        return ScheduleStatus.Ahead;
      }
      if (behind.has(reason)) {
        return ScheduleStatus.Behind;
      }
      if (onTime.has(reason)) {
        return ScheduleStatus.OnTime;
      }
    }

    const summaries = await summaryLoader.load(self.report.id);
    const summary = summaries.Cumulative;
    if (!summary) {
      return null;
    }
    const actual = clamp(summary.actual, 0, 1);
    const planned = clamp(summary.planned, 0, 1);
    const variance = actual - planned;
    return ScheduleStatus.fromVariance(variance);
  }
}
