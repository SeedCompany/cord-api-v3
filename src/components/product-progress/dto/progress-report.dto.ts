import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { Merge } from 'type-fest';
import {
  ID,
  SecuredFloatNullable,
  SecuredProps,
  UnsecuredDto,
} from '../../../common';
import { ProductStep } from '../../product';

@ObjectType({
  description: 'The progress of a product for a given report',
})
export class ProductProgress {
  static readonly Props = keysOf<ProductProgress>();
  static readonly SecuredProps = keysOf<SecuredProps<ProductProgress>>();

  // Both of these only exist if progress has been reported for the product/report pair.
  // This object is really just a container/grouping of StepProgress nodes.
  // I have these here to show that they can exist in the DB, but they are private to the API.
  readonly id?: ID;
  readonly createdAt?: DateTime;

  readonly productId: ID;

  readonly reportId: ID;

  @Field(() => [StepProgress], {
    description: stripIndent`
      The progress of each step in this report.
      This list is ordered based order of product's steps, which is based on \`MethodologyAvailableSteps\`.
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
})
export class StepProgress {
  static readonly Props = keysOf<StepProgress>();
  static readonly SecuredProps = keysOf<SecuredProps<StepProgress>>();

  // Both of these only exist if progress has been reported (or explicitly set to null).
  // I have these here to show that they can exist in the DB, but they are private to the API.
  readonly id?: ID;
  readonly createdAt?: DateTime;

  @Field(() => ProductStep)
  readonly step: ProductStep;

  @Field({
    description: stripIndent`
      The currently completed value for the step.

      This will be 0 <= \`completed\` <= the product's \`progressTarget\` number.

      If no progress has been reported yet this will be null,
      or this could be explicitly set to null.
    `,
  })
  readonly completed: SecuredFloatNullable;
}
