import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import {
  DbLabel,
  ID,
  SecuredFloat,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { SetChangeType } from '../../../core/database/changes';
import {
  SecuredScriptureRangesOverride,
  SecuredUnspecifiedScripturePortion,
} from '../../scripture';
import { SecuredMethodologySteps } from './methodology-step.enum';
import { Producible, SecuredProducible } from './producible.dto';
import { SecuredProductMediums } from './product-medium';
import { SecuredMethodology } from './product-methodology';
import { SecuredProductPurposes } from './product-purpose';
import { SecuredProgressMeasurement } from './progress-measurement.enum';

@InterfaceType({
  resolveType: (product: AnyProduct) =>
    product.produces
      ? DerivativeScriptureProduct
      : product.title
      ? OtherProduct
      : DirectScriptureProduct,
  implements: [Producible],
})
export class Product extends Producible {
  static readonly Props: string[] = keysOf<Product>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Product>>();

  readonly engagement: ID;

  @Field()
  @DbLabel('ProductMedium')
  readonly mediums: SecuredProductMediums;

  @Field()
  @DbLabel('ProductPurpose')
  readonly purposes: SecuredProductPurposes;

  @Field()
  @DbLabel('ProductMethodology')
  readonly methodology: SecuredMethodology;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  @Field({
    description: stripIndent`
      What steps will be worked for this product?
      Only certain steps are available according to the chosen methodology.
    `,
  })
  readonly steps: SecuredMethodologySteps;

  @Field({
    description: stripIndent`
      What does "complete" mean for this product?
    `,
  })
  readonly describeCompletion: SecuredStringNullable;

  @Field({
    description: 'How will progress for each step be measured?',
  })
  readonly progressStepMeasurement: SecuredProgressMeasurement;

  @Field({
    description: stripIndent`
      The target number that \`StepProgress\` is working towards.

      If \`Product.progressStepMeasurement\` is:
        - \`Percent\`: this will always be _100.0_
        - \`Boolean\`: this will always be _1.0_
        - \`Number\`: this can be any positive number
    `,
  })
  readonly progressTarget: SecuredFloat;
}

@ObjectType({
  implements: [Product],
  description: stripIndent`
    A product producing direct scripture only.
  `,
})
export class DirectScriptureProduct extends Product {
  static readonly Props = keysOf<DirectScriptureProduct>();
  static readonly SecuredProps = keysOf<SecuredProps<DirectScriptureProduct>>();

  @Field({
    description: stripIndent`
      An unspecified portion of scripture which this product is translating.

      Usage of this is always discouraged in favor of explicit scripture references.
      This is needed for legacy data where we only know the total verse count.
    `,
  })
  unspecifiedScripture: SecuredUnspecifiedScripturePortion;
}

@ObjectType({
  implements: [Product],
  description: stripIndent`
    A product producing derivative of scripture.
    Only meaning that this has a relationship to a \`Producible\` object.
  `,
})
export class DerivativeScriptureProduct extends Product {
  static readonly Props = keysOf<DerivativeScriptureProduct>();
  static readonly SecuredProps =
    keysOf<SecuredProps<DerivativeScriptureProduct>>();

  @Field(() => SecuredProducible, {
    description: stripIndent`
      The object that this product is producing.
      i.e. A film named "Jesus Film".
    `,
  })
  readonly produces: SecuredProducible & SetChangeType<'produces', ID>;

  @Field({
    description: stripIndent`
      The \`Producible\` defines a \`scriptureReferences\` list, and this is
      used by default in this product's \`scriptureReferences\` list.
      If this product _specifically_ needs to customize the references, then
      this property can be set (and read) to "override" the \`producible\`'s list.
    `,
  })
  readonly scriptureReferencesOverride: SecuredScriptureRangesOverride;
}

@ObjectType({
  implements: [Product],
  description:
    'A product which does not fit into the other two types of products',
})
export class OtherProduct extends Product {
  static readonly Props = keysOf<OtherProduct>();
  static readonly SecuredProps = keysOf<SecuredProps<OtherProduct>>();

  @Field()
  readonly title: SecuredString;

  @Field()
  readonly description: SecuredStringNullable;
}

export type AnyProduct = MergeExclusive<
  MergeExclusive<DirectScriptureProduct, DerivativeScriptureProduct>,
  OtherProduct
>;
