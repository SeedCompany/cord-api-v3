import { InputType, Field, ObjectType, ID } from 'type-graphql';

import { BibleBook } from './bible-book';
import { ProductType } from './product-type';
import { ProductMedium } from './product-medium';
import { ProductApproach } from './product-approach';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
import { BaseNode } from 'src/common/base-node';

@InputType()
export class CreateProductInput {
  @Field(type => ProductType)
  type: ProductType;
  @Field(type => [BibleBook])
  books: BibleBook[];
  @Field(type => [ProductMedium])
  mediums: ProductMedium[];
  @Field(type => [ProductPurpose])
  purposes: ProductPurpose[];
  @Field(type => ProductApproach)
  approach: ProductApproach;
  @Field(type => ProductMethodology)
  methodology: ProductMethodology;
}

@InputType()
export class CreateProductInputDto {
  @Field(type => CreateProductInput)
  product: CreateProductInput;
}

@ObjectType()
export class CreateProductOutput extends BaseNode {
  @Field(type => ID)
  id: string;
}

@ObjectType()
export class CreateProductOutputDto {
  @Field(type => CreateProductOutput, { nullable: true })
  product: CreateProductOutput;

  constructor() {
    this.product = new CreateProductOutput();
  }
}
