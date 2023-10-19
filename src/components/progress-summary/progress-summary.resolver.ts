import { Args, Float, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ArgsOptions } from '@nestjs/graphql/dist/decorators/args.decorator';
import { simpleSwitch } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { clamp } from 'lodash';
import { ProgressFormat } from '../product-progress/dto';
import { ProgressSummary, ScheduleStatus } from './dto';

const formatArg: ArgsOptions = {
  name: 'format',
  type: () => ProgressFormat,
  defaultValue: ProgressFormat.Decimal,
  description: stripIndent`
    The format the progress value will be returned in

    Some formats are not supported, in these cases the default format will be used.
  `,
};

@Resolver(ProgressSummary)
export class ProgressSummaryResolver {
  @ResolveField()
  planned(
    @Parent() summary: ProgressSummary,
    @Args(formatArg) format: ProgressFormat,
  ): number {
    const planned = clamp(summary.planned, 0, 1);
    return planned * this.formatFactor(summary, format);
  }

  @ResolveField()
  actual(
    @Parent() summary: ProgressSummary,
    @Args(formatArg) format: ProgressFormat,
  ): number {
    const actual = clamp(summary.actual, 0, 1);
    return actual * this.formatFactor(summary, format);
  }

  private formatFactor(summary: ProgressSummary, format: ProgressFormat) {
    const factor = simpleSwitch(format, {
      [ProgressFormat.Numerator]: null,
      [ProgressFormat.Decimal]: 1,
      [ProgressFormat.Percent]: 100,
      [ProgressFormat.Verses]: summary.totalVerses,
      [ProgressFormat.VerseEquivalents]: summary.totalVerseEquivalents,
    });
    return factor ?? 1;
  }

  @ResolveField(() => Float, {
    description: 'The difference between the actual and planned values',
  })
  variance(
    @Parent() summary: ProgressSummary,
    @Args(formatArg) format: ProgressFormat,
  ): number {
    return this.actual(summary, format) - this.planned(summary, format);
  }

  @ResolveField(() => ScheduleStatus, {
    description: 'Is the variance great enough to be ahead/behind?',
  })
  scheduleStatus(@Parent() summary: ProgressSummary): ScheduleStatus {
    const variance = this.variance(summary, ProgressFormat.Decimal);
    return ScheduleStatus.fromVariance(variance);
  }
}
