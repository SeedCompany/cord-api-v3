import { ProductType } from './product-type';
import { BibleBook } from './bible-book';
import { ProductApproach } from './product-approach';
import { ProductMedium } from './product-medium';
import { ProductMethodology } from './product-methodology';
import { ProductPurpose } from './product-purpose';
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
