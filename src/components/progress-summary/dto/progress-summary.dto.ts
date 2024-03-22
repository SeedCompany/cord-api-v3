import { Field, Float, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { LinkTo } from '~/core/resources';

@ObjectType({
  description: stripIndent`
    Product progress summary data for the a given progress report.
    Currently parsed out of the pnp report file.
  `,
})
export abstract class ProgressSummary {
  static readonly Props = keysOf<ProgressSummary>();
  static readonly SecuredProps = keysOf<SecuredProps<ProgressSummary>>();

  @Field(() => Float)
  planned: number;

  @Field(() => Float)
  actual: number;

  // Total verses across all products in the engagement this summary is under
  totalVerses?: number;
  // Total verse equivalents across all products in the engagement this summary is under
  totalVerseEquivalents?: number;
}

export enum SummaryPeriod {
  ReportPeriod = 'ReportPeriod',
  FiscalYearSoFar = 'FiscalYearSoFar',
  Cumulative = 'Cumulative',
}

export type FetchedSummaries = {
  report: LinkTo<'ProgressReport'>;
  // Total verses across all products in the engagement this summary is under
  totalVerses?: number;
  // Total verse equivalents across all products in the engagement this summary is under
  totalVerseEquivalents?: number;
} & Record<SummaryPeriod, ProgressSummary | null>;
