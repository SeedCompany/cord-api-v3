import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { Merge } from 'type-fest';
import {
  ID,
  Resource,
  SecuredFloatNullable,
  SecuredProps,
  UnsecuredDto,
} from '../../../common';
import { MethodologyStep } from '../../product';

@ObjectType({
  description: 'The progress of a product for a given report',
  implements: [Resource],
})
export class ProductProgress extends Resource {
  static readonly Props = keysOf<ProductProgress>();
  static readonly SecuredProps = keysOf<SecuredProps<ProductProgress>>();

  readonly productId: ID;

  readonly reportId: ID;

  @Field(() => [StepProgress], {
    description: stripIndent`
      The progress of each step in this report.
      If a step doesn't have a reported value (or it was set to null) it will be omitted from this list.
    `,
  })
  readonly steps: readonly StepProgress[];
}

export type UnsecuredProductProgress = Merge<
  UnsecuredDto<ProductProgress>,
  {
    steps: ReadonlyArray<UnsecuredDto<StepProgress>>;
  }
>;

@ObjectType({
  description: `The progress of a product's step for a given report`,
  implements: [Resource],
})
export class StepProgress extends Resource {
  static readonly Props = keysOf<StepProgress>();
  static readonly SecuredProps = keysOf<SecuredProps<StepProgress>>();

  @Field(() => MethodologyStep)
  readonly step: MethodologyStep;

  @Field({
    description: 'The percent (0-100) complete for the step',
  })
  readonly percentDone: SecuredFloatNullable;
}
