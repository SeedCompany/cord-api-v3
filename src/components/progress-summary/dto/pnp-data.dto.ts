import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';

@ObjectType({
  description: stripIndent`
    Temporary summary values from the pnp spreadsheet,
    until all the data can be moved into the app.
  `,
})
export abstract class PnpData {
  @Field(() => Float)
  progressPlanned: number;

  @Field(() => Float)
  progressActual: number;

  @Field(() => Float)
  variance: number;

  @Field(() => Int)
  year: number;

  @Field(() => Int)
  quarter: number;
}
