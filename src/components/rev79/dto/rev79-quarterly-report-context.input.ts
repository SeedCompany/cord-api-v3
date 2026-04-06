import { Field, InputType } from '@nestjs/graphql';
import { QuarterPeriodInput } from './quarter-period.input';

@InputType({
  description:
    'Input for resolving a quarterly progress report context by Rev79 identifiers.',
})
export class Rev79QuarterlyReportContextInput {
  @Field({
    description: 'The Rev79 project identifier to look up the Cord project.',
  })
  readonly rev79ProjectId: string;

  @Field({
    description:
      'The Rev79 community identifier to look up the language engagement within the project.',
  })
  readonly rev79CommunityId: string;

  @Field(() => QuarterPeriodInput, {
    description: 'The year and quarter to resolve the progress report for.',
  })
  readonly period: QuarterPeriodInput;
}
