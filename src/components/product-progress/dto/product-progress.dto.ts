import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { Merge } from 'type-fest';
import {
  ID,
  SecuredFloatNullable,
  SecuredProps,
  SetUnsecuredType,
  UnsecuredDto,
  Variant,
} from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { Product, ProductStep } from '../../product/dto';
import { ProgressReport } from '../../progress-report/dto';
import {
  ProgressReportVariantProgress,
  ProgressVariant,
} from './variant-progress.dto';

export interface ProgressVariantByProductInput {
  product: Product;
  variant: Variant<ProgressVariant>;
}

export interface ProgressVariantByProductOutput
  extends Pick<ProgressReportVariantProgress, 'variant' | 'details'> {
  product: Product;
}

export interface ProgressVariantByReportInput {
  report: ProgressReport;
  variant: Variant<ProgressVariant>;
}

export interface ProgressVariantByReportOutput
  extends Pick<ProgressReportVariantProgress, 'variant' | 'details'> {
  report: ProgressReport;
}

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

  @Field(() => Variant)
  readonly variant: Variant<ProgressVariant> &
    SetUnsecuredType<ProgressVariant>;

  @Field(() => [StepProgress], {
    description: stripIndent`
      The progress of each step in this report.
      This list is ordered based order of product's steps, which is based on \`MethodologyAvailableSteps\`.
    `,
    middleware: [
      // Add productId so it can be accessed in StepProgress.completed resolver
      async (ctx, next) => {
        const value = await next();
        for (const sp of value) {
          sp.productId = ctx.source.productId;
        }
        return value;
      },
    ],
  })
  readonly steps: readonly StepProgress[];
}

export type UnsecuredProductProgress = Merge<
  UnsecuredDto<ProductProgress>,
  {
    steps: ReadonlyArray<UnsecuredDto<StepProgress>>;
  }
>;

@RegisterResource({ db: e.ProgressReport.ProductProgress.Step })
@ObjectType({
  description: `The progress of a product's step for a given report`,
})
export class StepProgress {
  static readonly Props = keysOf<StepProgress>();
  static readonly SecuredProps = keysOf<SecuredProps<StepProgress>>();
  static readonly Parent = () =>
    import('../../progress-report/dto').then(
      (m) => m.ProgressReport, // technically ProgressReport & Product
    );
  static readonly Variants = ProgressReportVariantProgress.Variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;

  // Both of these only exist if progress has been reported (or explicitly set to null).
  // I have these here to show that they can exist in the DB, but they are private to the API.
  readonly id?: ID;
  readonly createdAt?: DateTime;

  @Field(() => ProductStep)
  readonly step: ProductStep;

  @Field({
    description: stripIndent`
      The currently completed value for the step.

      If no progress has been reported yet this will be null,
      or this could be explicitly set to null.
    `,
  })
  readonly completed: SecuredFloatNullable;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    StepProgress: typeof StepProgress;
  }
  interface ResourceDBMap {
    StepProgress: typeof e.ProgressReport.ProductProgress.Step;
  }
}
