import { Field, Float, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, SecuredProps } from '../../../common';
import { MethodologyStep } from '../../product';

@ObjectType({
  description: 'The progress of a product for a given report',
})
export class ProductProgress {
  static readonly Props = keysOf<ProductProgress>();
  static readonly SecuredProps = keysOf<SecuredProps<ProductProgress>>();

  readonly productId: ID;

  readonly reportId: ID;

  @Field(() => [StepProgress], {
    description: stripIndent`
      The progress of each step in this report.
      If a step doesn't have a reported value it will be omitted from this list.
    `,
  })
  readonly steps: readonly StepProgress[];
}

@ObjectType({
  description: `The progress of a product's step for a given report`,
})
export class StepProgress {
  static readonly Props = keysOf<StepProgress>();
  static readonly SecuredProps = keysOf<SecuredProps<StepProgress>>();

  @Field(() => MethodologyStep)
  readonly step: MethodologyStep;

  @Field(() => Float)
  readonly percentDone: number;
}
