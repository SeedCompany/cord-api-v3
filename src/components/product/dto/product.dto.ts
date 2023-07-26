import { Field, Float, Int, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { startCase } from 'lodash';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import { RegisterResource } from '~/core/resources';
import {
  DbLabel,
  ID,
  Secured,
  SecuredBoolean,
  SecuredFloat,
  SecuredProps,
  SecuredString,
  SecuredStringNullable,
  Sensitivity,
  SensitivityField,
  ServerException,
  SetUnsecuredType,
  UnsecuredDto,
} from '../../../common';
import { SetChangeType } from '../../../core/database/changes';
import {
  DbScriptureReferences,
  ScriptureRangeInput,
  SecuredScriptureRangesOverride,
  SecuredUnspecifiedScripturePortion,
} from '../../scripture';
import { Producible, ProducibleRef, SecuredProducible } from './producible.dto';
import { SecuredProductMediums } from './product-medium';
import { SecuredMethodology } from './product-methodology';
import { SecuredProductPurposes } from './product-purpose';
import { SecuredProductSteps } from './product-step.enum';
import { SecuredProgressMeasurement } from './progress-measurement.enum';

const resolveProductType = (product: AnyProduct | UnsecuredDto<AnyProduct>) =>
  product.produces
    ? DerivativeScriptureProduct
    : product.title
    ? OtherProduct
    : DirectScriptureProduct;

@RegisterResource()
@InterfaceType({
  resolveType: resolveProductType,
  implements: [Producible],
})
export class Product extends Producible {
  static readonly Props: string[] = keysOf<Product>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Product>>();
  static readonly Parent = import('../../engagement/dto').then(
    (m) => m.LanguageEngagement,
  );

  readonly engagement: ID;
  readonly project: ID;

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
  readonly steps: SecuredProductSteps;

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

  @Field({
    description: stripIndent`
      Is this product a placeholder for a real product to be determined later?
      If so, this is the description to show in the mean time.
    `,
  })
  readonly placeholderDescription: SecuredStringNullable;
}

@RegisterResource()
@ObjectType({
  implements: [Product],
  description: stripIndent`
    A product producing direct scripture only.
  `,
})
export class DirectScriptureProduct extends Product {
  static readonly Props = keysOf<DirectScriptureProduct>();
  static readonly SecuredProps = keysOf<SecuredProps<DirectScriptureProduct>>();
  static readonly Parent = Product.Parent;

  @Field({
    description: stripIndent`
      An unspecified portion of scripture which this product is translating.

      Usage of this is always discouraged in favor of explicit scripture references.
      This is needed for legacy data where we only know the total verse count.
    `,
  })
  @DbLabel('UnspecifiedScripturePortion')
  unspecifiedScripture: SecuredUnspecifiedScripturePortion;

  @Field(() => Int, {
    description:
      'The total number of verses of the selected scripture in this product',
  })
  totalVerses: number;

  @Field(() => Float, {
    description: stripIndent`
      The total number of verse equivalents of the selected scripture in this product.
      Verse equivalents weight each verse based on its translation difficulty.
    `,
  })
  totalVerseEquivalents: number;

  readonly pnpIndex?: number;
}

@RegisterResource()
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
  static readonly Parent = Product.Parent;

  @Field(() => SecuredProducible, {
    description: stripIndent`
      The object that this product is producing.
      i.e. A film named "Jesus Film".
    `,
  })
  readonly produces: Secured<ProducibleRef> & SetChangeType<'produces', ID>;

  @Field(() => SecuredScriptureRangesOverride, {
    description: stripIndent`
      The \`Producible\` defines a \`scriptureReferences\` list, and this is
      used by default in this product's \`scriptureReferences\` list.
      If this product _specifically_ needs to customize the references, then
      this property can be set (and read) to "override" the \`producible\`'s list.
    `,
  })
  readonly scriptureReferencesOverride: SecuredScriptureRangesOverride &
    SetUnsecuredType<DbScriptureReferences | null> &
    SetChangeType<
      'scriptureReferencesOverride',
      readonly ScriptureRangeInput[] | null
    >;

  @Field({
    description: stripIndent`
      Represents whether the \`Producible\` being referenced is multiple composite stories
    `,
  })
  readonly composite: SecuredBoolean;

  @Field(() => Int, {
    description:
      'The total number of verses of the selected scripture in this product',
  })
  totalVerses: number;

  @Field(() => Float, {
    description: stripIndent`
      The total number of verse equivalents of the selected scripture in this product.
      Verse equivalents weight each verse based on its translation difficulty.
    `,
  })
  totalVerseEquivalents: number;
}

@RegisterResource()
@ObjectType({
  implements: [Product],
  description:
    'A product which does not fit into the other two types of products',
})
export class OtherProduct extends Product {
  static readonly Props = keysOf<OtherProduct>();
  static readonly SecuredProps = keysOf<SecuredProps<OtherProduct>>();
  static readonly Parent = Product.Parent;

  @Field()
  readonly title: SecuredString;

  @Field()
  readonly description: SecuredStringNullable;
}

export type AnyProduct = MergeExclusive<
  MergeExclusive<DirectScriptureProduct, DerivativeScriptureProduct>,
  OtherProduct
>;

/**
 * Confirms the given product is of the type specified, if not an error is thrown.
 *
 * This should be used when we assume the product type is one of the concretes and
 * we just want to narrow the type in a safe way.
 */
export const asProductType =
  <Concrete extends ReturnType<typeof resolveProductType>>(
    expected: Concrete,
  ) =>
  <Given extends AnyProduct | UnsecuredDto<AnyProduct>>(
    product: Given,
  ): Given extends AnyProduct
    ? Concrete['prototype']
    : UnsecuredDto<Concrete['prototype']> => {
    if (resolveProductType(product) !== expected) {
      const type = startCase(expected.name.replace(/Product$/, ''));
      throw new ServerException(`Product was not the ${type} type`);
    }
    // Ironic that we need to bail out here, but the input/output of this method
    // is safe and this logic is sound.
    return product as any;
  };

declare module '~/core/resources/map' {
  interface ResourceMap {
    Product: typeof Product;
    DirectScriptureProduct: typeof DirectScriptureProduct;
    DerivativeScriptureProduct: typeof DerivativeScriptureProduct;
    OtherProduct: typeof OtherProduct;
  }
}
