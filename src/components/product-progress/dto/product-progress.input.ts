import { Field, Float, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { Min, ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import { type ID, IdField } from '~/common';
import { ProductStep } from '../../product/dto';
import { VariantProgressArg } from './variant-progress.dto';

@InputType()
export abstract class ProductProgressInput extends VariantProgressArg {
  @IdField({
    description: 'Which product are you reporting on?',
  })
  readonly productId: ID;

  @IdField({
    description: stripIndent`
      An ID of a ProgressReport.
      This describes what timeframe is this data for.
    `,
  })
  readonly reportId: ID;

  @Field(() => [StepProgressInput], {
    description: stripIndent`
      Data for this entry.
      Each item should be a step the product has with the percent
      done it is.
    `,
  })
  @Type(() => StepProgressInput)
  @ValidateNested()
  readonly steps: readonly StepProgressInput[];
}

@InputType()
export abstract class StepProgressInput {
  @Field(() => ProductStep)
  readonly step: ProductStep;

  @Field(() => Float, {
    nullable: true,
    description: stripIndent`
      The new completed value for the step or null to remove the current value.

      This should be 0 <= \`completed\` <= the product's \`progressTarget\` number.
    `,
  })
  @Min(0)
  readonly completed?: number | null;
}
