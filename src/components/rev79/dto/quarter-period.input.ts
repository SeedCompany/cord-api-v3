import { Field, InputType, Int } from '@nestjs/graphql';

@InputType({
  description: 'A fiscal quarter within a specific year.',
})
export class QuarterPeriodInput {
  @Field(() => Int, {
    description: 'Fiscal year (e.g. 2024)',
  })
  readonly year: number;

  @Field(() => Int, {
    description:
      'Quarter number: 1 = Oct–Dec, 2 = Jan–Mar, 3 = Apr–Jun, 4 = Jul–Sep',
  })
  readonly quarter: number;
}
