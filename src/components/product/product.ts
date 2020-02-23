import { ProductType } from './dto/product-type';
import { BibleBook } from './dto/bible-book';
import { ProductApproach } from './dto/product-approach';
import { ProductMedium } from './dto/product-medium';
import { ProductMethodology } from './dto/product-methodology';
import { ProductPurpose } from './dto/product-purpose';
import {
  Field,
  ID,
  InputType,
  ObjectType,
  registerEnumType,
} from 'type-graphql';
import { BaseNode } from '../../common/base-node';

@ObjectType()
@InputType('productInput')
export class Product {
  @Field(() => ID)
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
export interface Product extends BaseNode {
  type: ProductType;
  books: BibleBook[];
  mediums: ProductMedium[];
  purposes: ProductPurpose[];
  approach: ProductApproach;
  methodology: ProductMethodology;
}
