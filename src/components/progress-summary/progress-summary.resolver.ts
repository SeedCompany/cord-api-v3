import { Args, Float, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ArgsOptions } from '@nestjs/graphql/dist/decorators/args.decorator';
import { stripIndent } from 'common-tags';
import { simpleSwitch } from '../../common';
import { ProgressFormat } from '../product-progress/dto';
import { ProgressSummary } from './dto';

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
    @Args(formatArg) format: ProgressFormat
  ): number {
    return summary.planned * this.formatFactor(summary, format);
  }

  @ResolveField()
  actual(
    @Parent() summary: ProgressSummary,
    @Args(formatArg) format: ProgressFormat
  ): number {
    return summary.actual * this.formatFactor(summary, format);
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
  variance(@Parent() summary: ProgressSummary): number {
    return summary.actual - summary.planned;
  }
}
