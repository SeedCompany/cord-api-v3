import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { MergeExclusive } from 'type-fest';
import { Resource } from '../../../common';
import { SecuredScriptureRangesOverride } from '../../scripture';
import { Producible, SecuredProducible } from './producible.dto';
import { SecuredProductMediums } from './product-medium';
import { SecuredMethodology } from './product-methodology';
import { SecuredProductPurposes } from './product-purpose';

@InterfaceType({
  resolveType: (product: AnyProduct) =>
    product.produces ? DerivativeScriptureProduct : DirectScriptureProduct,
})
export class Product extends Producible {
  @Field()
  readonly mediums: SecuredProductMediums;

  @Field()
  readonly purposes: SecuredProductPurposes;

  @Field()
  readonly methodology: SecuredMethodology;
}

@ObjectType({
  implements: [Product, Producible, Resource],
  description: stripIndent`
    A product producing direct scripture only.
  `,
})
export class DirectScriptureProduct extends Product {}

@ObjectType({
  implements: [Product, Producible, Resource],
  description: stripIndent`
    A product producing derivative of scripture.
    Only meaning that this has a relationship to a \`Producible\` object.
  `,
})
export class DerivativeScriptureProduct extends Product {
  @Field({
    description: stripIndent`
      The object that this product is producing.
      i.e. A film named "Jesus Film".
    `,
  })
  readonly produces: SecuredProducible;

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
