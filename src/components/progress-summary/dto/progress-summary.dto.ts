import { Field, Float, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '../../../common';

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
}

export enum SummaryPeriod {
  ReportPeriod = 'ReportPeriod',
  FiscalYearSoFar = 'FiscalYearSoFar',
  Cumulative = 'Cumulative',
}
