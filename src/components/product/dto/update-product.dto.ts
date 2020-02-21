import { Type } from 'class-transformer';
import {
  MinLength,
  ValidateNested,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
import { Field, ID, InputType, ObjectType, Int } from 'type-graphql';
import { Product } from './product.dto';
import { BibleBook } from '../bible-book';
import { ProductType } from '../product-type';
import { ProductMedium } from '../product-medium';
import { ProductApproach } from '../product-approach';
import { ProductMethodology } from '../product-methodology';
import { ProductPurpose } from '../product-purpose';

@InputType()
export abstract class UpdateProduct {
  @Field(type => ID)
  readonly id: string;

  @Field(type => ProductType, { nullable: true })
  readonly type: ProductType;

  @Field(type => [BibleBook], { nullable: true })
  readonly books: BibleBook[];

  @Field(type => [ProductMedium], { nullable: true })
  readonly mediums: ProductMedium[];

  @Field(type => [ProductPurpose], { nullable: true })
  readonly purposes: ProductPurpose[];

  @Field(type => ProductApproach, { nullable: true })
  readonly approach: ProductApproach;

  @Field(type => ProductMethodology, { nullable: true })
  readonly methodology: ProductMethodology;
}

// @InputType()
// export abstract class UpdateProductInput {
//   @Field()
//   @Type(() => UpdateProduct)
//   @ValidateNested()
//   readonly product: UpdateProduct;
// }

// @ObjectType()
// export abstract class UpdateProductOutput {
//   @Field()
//   readonly product: Product;
// }
