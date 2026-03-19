import { Field, InputType, Int } from '@nestjs/graphql';

@InputType({
  description: 'A fiscal/calendar quarter within a specific year.',
})
export class QuarterPeriodInput {
  @Field(() => Int, {
    description: 'Calendar year (e.g. 2024)',
  })
  readonly year: number;

  @Field(() => Int, {
    description:
      'Quarter number: 1 = Jan–Mar, 2 = Apr–Jun, 3 = Jul–Sep, 4 = Oct–Dec',
  })
  readonly quarter: number;
}
