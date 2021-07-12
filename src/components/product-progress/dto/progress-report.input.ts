import { Field, Float, InputType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { ID, IdField } from '../../../common';
import { MethodologyStep } from '../../product';

@InputType()
export abstract class ProductProgressInput {
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
  readonly steps: readonly StepProgressInput[];
}

@InputType()
export abstract class StepProgressInput {
  @Field(() => MethodologyStep)
  readonly step: MethodologyStep;

  @Field(() => Float, {
    nullable: true,
    description:
      'The new percent (0-100) complete for the step or null to remove the current value.',
  })
  readonly percentDone: number | null;
}
