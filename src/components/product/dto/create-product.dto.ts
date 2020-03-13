import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import { BibleBook } from './bible-book';
import { ProductApproach } from './product-approach';
import { ProductMedium } from './product-medium';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
import { ProductType } from './product-type';
import { Product } from './product.dto';

@InputType()
export abstract class CreateProduct {
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

@InputType()
export abstract class CreateProductInput {
  @Field()
  @Type(() => CreateProduct)
  @ValidateNested()
  readonly product: CreateProduct;
}

@ObjectType()
export abstract class CreateProductOutput {
  @Field()
  readonly product: Product;
}
