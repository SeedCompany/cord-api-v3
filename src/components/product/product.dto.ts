import { InputType, Field, ObjectType, ID } from 'type-graphql';
import { BaseNode } from '../../common/base-node';
import { BibleBook } from './bible-book';
import { ProductType } from './product-type';
import { ProductMedium } from './product-medium';
import { ProductApproach } from './product-approach';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';

// @InputType()
// export class CreateProductInput {
//   @Field(type => ProductType)
//   type: ProductType;
//   @Field(type => [BibleBook])
//   books: BibleBook[];
//   @Field(type => [ProductMedium])
//   mediums: ProductMedium[];
//   @Field(type => [ProductPurpose])
//   purposes: ProductPurpose[];
//   @Field(type => ProductApproach)
//   approach: ProductApproach;
//   @Field(type => ProductMethodology)
//   methodology: ProductMethodology;
// }

// @InputType()
// export class CreateProductInputDto {
//   @Field(type => CreateProductInput)
//   product: CreateProductInput;
// }

// @ObjectType()
// export class CreateProductOutput extends BaseNode {
//   @Field(type => String)
//   id: string;
//   @Field(type => ProductType)
//   type: ProductType;
//   @Field(type => [BibleBook])
//   books: BibleBook[];
//   @Field(type => [ProductMedium])
//   mediums: ProductMedium[];
//   @Field(type => [ProductPurpose])
//   purposes: ProductPurpose[];
//   @Field(type => ProductApproach)
//   approach: ProductApproach;
//   @Field(type => ProductMethodology)
//   methodology: ProductMethodology;
// }

// @ObjectType()
// export class CreateProductOutputDto {
//   @Field({ nullable: true }) // nullable in case of error
//   product: CreateProductOutput;

//   constructor() {
//     this.product = new CreateProductOutput();
//   }
// }
// READ

@InputType()
export class ReadProductInput {
  @Field(type => ID)
  id: string;
}

@InputType()
export class ReadProductInputDto {
  @Field()
  product: ReadProductInput;
}

// UPDATE

@InputType()
export class UpdateProductInput {
  @Field(type => ID)
  id: string;
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
export class UpdateProductInputDto {
  @Field()
  product: UpdateProductInput;
}

@ObjectType()
export class UpdateProductOutput {
  @Field(type => ID)
  id: string;
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

@ObjectType()
export class UpdateProductOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  product: UpdateProductOutput;

  constructor() {
    this.product = new UpdateProductOutput();
  }
}

// DELETE

@InputType()
export class DeleteProductInput {
  @Field(type => String)
  id: string;
}

@InputType()
export class DeleteProductInputDto {
  @Field()
  product: DeleteProductInput;
}

@ObjectType()
export class DeleteProductOutput {
  @Field(type => String)
  id: string;
}

@ObjectType()
export class DeleteProductOutputDto {
  @Field({ nullable: true }) // nullable in case of error
  product: DeleteProductOutput;

  constructor() {
    this.product = new DeleteProductOutput();
  }
}
