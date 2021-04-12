import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { MergeExclusive } from 'type-fest';
import { DbLabel, ID, SecuredProps } from '../../../common';
import { SetChangeType } from '../../../core/database/changes';
import { SecuredScriptureRangesOverride } from '../../scripture';
import { Producible, SecuredProducible } from './producible.dto';
import { SecuredProductMediums } from './product-medium';
import { SecuredMethodology } from './product-methodology';
import { SecuredProductPurposes } from './product-purpose';

@InterfaceType({
  resolveType: (product: AnyProduct) =>
    product.produces ? DerivativeScriptureProduct : DirectScriptureProduct,
  implements: [Producible],
})
export class Product extends Producible {
  static readonly Props: string[] = keysOf<Product>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Product>>();

  @Field()
  @DbLabel('ProductMedium')
  readonly mediums: SecuredProductMediums;

  @Field()
  @DbLabel('ProductPurpose')
  readonly purposes: SecuredProductPurposes;

  @Field()
  @DbLabel('ProductMethodology')
  readonly methodology: SecuredMethodology;
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
  static readonly SecuredProps = keysOf<
    SecuredProps<DerivativeScriptureProduct>
  >();

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

export type AnyProduct = MergeExclusive<
  DirectScriptureProduct,
  DerivativeScriptureProduct
>;
