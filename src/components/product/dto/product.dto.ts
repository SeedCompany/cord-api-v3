import { Field, ObjectType } from '@nestjs/graphql';
import { Resource } from '../../../common';
import { BibleBook } from './bible-book';
import { ProductApproach } from './product-approach';
import { ProductMedium } from './product-medium';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
import { ProductType } from './product-type';

@ObjectType({
  implements: [Resource],
})
export class Product extends Resource {
  @Field(() => ProductType)
  readonly type: ProductType;

  @Field(() => [BibleBook])
  readonly books: BibleBook[];

  @Field(() => [ProductMedium])
  readonly mediums: ProductMedium[];

  @Field(() => [ProductPurpose])
  readonly purposes: ProductPurpose[];

  @Field(() => ProductApproach)
  readonly approach: ProductApproach;

  @Field(() => ProductMethodology)
  readonly methodology: ProductMethodology;
}
