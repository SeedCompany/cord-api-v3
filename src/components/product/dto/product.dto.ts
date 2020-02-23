import { Field, ObjectType, registerEnumType } from 'type-graphql';
import { Resource } from '../../../common';
import { BibleBook } from '../bible-book';
import { ProductType } from '../product-type';
import { ProductMedium } from '../product-medium';
import { ProductApproach } from '../product-approach';
import { ProductMethodology } from '../product-methodology';
import { ProductPurpose } from '../product-purpose';

@ObjectType({
  implements: [Resource],
})
export class Product extends Resource {
  @Field(type => ProductType)
  readonly type: ProductType;

  @Field(type => [BibleBook])
  readonly books: BibleBook[];

  @Field(type => [ProductMedium])
  readonly mediums: ProductMedium[];

  @Field(type => [ProductPurpose])
  readonly purposes: ProductPurpose[];

  @Field(type => ProductApproach)
  readonly approach: ProductApproach;

  @Field(type => ProductMethodology)
  readonly methodology: ProductMethodology;
}
