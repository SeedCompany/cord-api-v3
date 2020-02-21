import { Type } from 'class-transformer';
import {
  ValidateNested,
} from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import { Product } from './product.dto';
import { BibleBook } from '../bible-book';
import { ProductType } from '../product-type';
import { ProductMedium } from '../product-medium';
import { ProductApproach } from '../product-approach';
import { ProductMethodology } from '../product-methodology';
import { ProductPurpose } from '../product-purpose';

@InputType()
export abstract class CreateProduct {
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

// @InputType()
// export abstract class CreateProductInput {
//   @Field()
//   @Type(() => CreateProduct)
//   @ValidateNested()
//   readonly product: CreateProduct;
// }

// @ObjectType()
// export abstract class CreateProductOutput {
//   @Field()
//   readonly product: Product;
// }