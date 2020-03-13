import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { BibleBook } from './bible-book';
import { ProductMedium } from './product-medium';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
import { ProductType } from './product-type';
import { Product } from './product.dto';

@InputType()
export abstract class UpdateProduct {
  @Field(() => ID)
  readonly id: string;

  @Field(() => ProductType, { nullable: true })
  readonly type: ProductType;

  @Field(() => [BibleBook], { nullable: true })
  readonly books: BibleBook[];

  @Field(() => [ProductMedium], { nullable: true })
  readonly mediums: ProductMedium[];

  @Field(() => [ProductPurpose], { nullable: true })
  readonly purposes: ProductPurpose[];

  @Field(() => ProductMethodology, { nullable: true })
  readonly methodology: ProductMethodology;
}

@InputType()
export abstract class UpdateProductInput {
  @Field()
  @Type(() => UpdateProduct)
  @ValidateNested()
  readonly product: UpdateProduct;
}

@ObjectType()
export abstract class UpdateProductOutput {
  @Field()
  readonly product: Product;
}
