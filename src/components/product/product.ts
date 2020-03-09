import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { BaseNode } from '../../common/base-node';
import { BibleBook } from './dto/bible-book';
import { ProductApproach } from './dto/product-approach';
import { ProductMedium } from './dto/product-medium';
import { ProductMethodology } from './dto/product-methodology';
import { ProductPurpose } from './dto/product-purpose';
import { ProductType } from './dto/product-type';

@ObjectType()
@InputType('productInput')
export class Product {
  @Field(() => ID)
  id: string;
  @Field(() => ProductType)
  type: ProductType;
  @Field(() => [BibleBook])
  books: BibleBook[];
  @Field(() => [ProductMedium])
  mediums: ProductMedium[];
  @Field(() => [ProductPurpose])
  purposes: ProductPurpose[];
  @Field(() => ProductApproach)
  approach: ProductApproach;
  @Field(() => ProductMethodology)
  methodology: ProductMethodology;
}
export interface Product extends BaseNode {
  type: ProductType;
  books: BibleBook[];
  mediums: ProductMedium[];
  purposes: ProductPurpose[];
  approach: ProductApproach;
  methodology: ProductMethodology;
}
