import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import {
  AsUpdateType,
  Grandparent,
  type ID,
  IdField,
  type Secured,
} from '~/common';
import { LanguageEngagement } from '../../engagement/dto';
import { LanguageEngagementMutation } from '../../engagement/dto/engagement-mutations.dto';
import {
  SecuredScriptureRanges,
  SecuredScriptureRangesOverride,
  SecuredUnspecifiedScripturePortion,
} from '../../scripture/dto';
import { type ProducibleRef, SecuredProducible } from './producible.dto';
import {
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  OtherProduct,
} from './product.dto';
import {
  UpdateBaseProduct,
  UpdateDerivativeScriptureProduct,
  UpdateDirectScriptureProduct,
  UpdateOtherProduct,
} from './update-product.dto';

@InterfaceType({ implements: [LanguageEngagementMutation] })
export class ProductMutationOrDeletion extends LanguageEngagementMutation {
  /** Why here? See {@link EngagementMutation.projectId} */
  @IdField()
  readonly productId: ID<'Product'>;
}

@InterfaceType({ implements: [ProductMutationOrDeletion] })
export class ProductMutation extends ProductMutationOrDeletion {}

@InterfaceType({ implements: [ProductMutation] })
export class DirectScriptureProductMutation extends ProductMutation {
  @Field(() => DirectScriptureProduct)
  readonly product?: never;
}

@InterfaceType({ implements: [ProductMutation] })
export class DerivativeScriptureProductMutation extends ProductMutation {
  @Field(() => DerivativeScriptureProduct)
  readonly product?: never;
}

@InterfaceType({ implements: [ProductMutation] })
export class OtherProductMutation extends ProductMutation {
  @Field(() => OtherProduct)
  readonly product?: never;
}

@InterfaceType({ implements: [ProductMutation] })
export abstract class ProductCreated extends ProductMutation {}

@ObjectType({
  implements: [DirectScriptureProductMutation, ProductCreated],
})
export class DirectScriptureProductCreated extends ProductCreated {
  declare readonly __typename: 'DirectScriptureProductCreated';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;

  @Field(() => DirectScriptureProduct)
  readonly product?: never;
}

@ObjectType({
  implements: [DerivativeScriptureProductMutation, ProductCreated],
})
export class DerivativeScriptureProductCreated extends ProductCreated {
  declare readonly __typename: 'DerivativeScriptureProductCreated';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;

  @Field(() => DerivativeScriptureProduct)
  readonly product?: never;
}

@ObjectType({ implements: [OtherProductMutation, ProductCreated] })
export class OtherProductCreated extends ProductCreated {
  declare readonly __typename: 'OtherProductCreated';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;

  @Field(() => OtherProduct)
  readonly product?: never;
}

@InterfaceType()
export class ProductUpdate extends AsUpdateType(UpdateBaseProduct, {
  omit: ['id'],
  links: [],
}) {}

@ObjectType({ implements: [ProductUpdate] })
export class DirectScriptureProductUpdate extends AsUpdateType(
  UpdateDirectScriptureProduct,
  {
    omit: [
      'id',
      'scriptureReferences',
      'unspecifiedScripture',
      'totalVerses',
      'totalVerseEquivalents',
    ],
    links: [],
  },
) {
  @Field({ nullable: true })
  readonly scriptureReferences?: SecuredScriptureRanges;

  @Field({ nullable: true })
  readonly unspecifiedScripture?: SecuredUnspecifiedScripturePortion;
}

@ObjectType({ implements: [ProductUpdate] })
export class DerivativeScriptureProductUpdate extends AsUpdateType(
  UpdateDerivativeScriptureProduct,
  {
    omit: [
      'id',
      'produces',
      'scriptureReferencesOverride',
      'totalVerses',
      'totalVerseEquivalents',
    ],
    links: [],
  },
) {
  @Field(() => SecuredProducible, { nullable: true })
  readonly produces?: Secured<ProducibleRef>;

  @Field(() => SecuredScriptureRangesOverride, { nullable: true })
  readonly scriptureReferencesOverride?: SecuredScriptureRangesOverride;
}

@ObjectType({ implements: [ProductUpdate] })
export class OtherProductUpdate extends AsUpdateType(UpdateOtherProduct, {
  omit: ['id'],
  links: [],
}) {}

@InterfaceType({ implements: [ProductMutation] })
export class ProductUpdated extends ProductMutation {
  @Field({ middleware: [Grandparent.store] })
  readonly previous: ProductUpdate;

  @Field({ middleware: [Grandparent.store] })
  readonly updated: ProductUpdate;
}

@ObjectType({
  implements: [DirectScriptureProductMutation, ProductUpdated],
})
export class DirectScriptureProductUpdated extends ProductUpdated {
  declare readonly __typename: 'DirectScriptureProductUpdated';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;

  @Field({ middleware: [Grandparent.store] })
  declare readonly previous: DirectScriptureProductUpdate;

  @Field({ middleware: [Grandparent.store] })
  declare readonly updated: DirectScriptureProductUpdate;

  @Field(() => DirectScriptureProduct)
  readonly product?: never;
}

@ObjectType({
  implements: [DerivativeScriptureProductMutation, ProductUpdated],
})
export class DerivativeScriptureProductUpdated extends ProductUpdated {
  declare readonly __typename: 'DerivativeScriptureProductUpdated';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;

  @Field({ middleware: [Grandparent.store] })
  declare readonly previous: DerivativeScriptureProductUpdate;

  @Field({ middleware: [Grandparent.store] })
  declare readonly updated: DerivativeScriptureProductUpdate;

  @Field(() => DerivativeScriptureProduct)
  readonly product?: never;
}

@ObjectType({ implements: [OtherProductMutation, ProductUpdated] })
export class OtherProductUpdated extends ProductUpdated {
  declare readonly __typename: 'OtherProductUpdated';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;

  @Field({ middleware: [Grandparent.store] })
  declare readonly previous: OtherProductUpdate;

  @Field({ middleware: [Grandparent.store] })
  declare readonly updated: OtherProductUpdate;

  @Field(() => OtherProduct)
  readonly product?: never;
}

@InterfaceType({ implements: [ProductMutationOrDeletion] })
export class ProductDeleted extends ProductMutationOrDeletion {}

@ObjectType({ implements: [ProductDeleted] })
export class DirectScriptureProductDeleted extends ProductDeleted {
  declare readonly __typename: 'DirectScriptureProductDeleted';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;
}

@ObjectType({ implements: [ProductDeleted] })
export class DerivativeScriptureProductDeleted extends ProductDeleted {
  declare readonly __typename: 'DerivativeScriptureProductDeleted';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;
}

@ObjectType({ implements: [ProductDeleted] })
export class OtherProductDeleted extends ProductDeleted {
  declare readonly __typename: 'OtherProductDeleted';

  @Field(() => LanguageEngagement)
  declare readonly engagement?: never;
}
