import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { ProductApproach } from './product-approach';
import { ProductMethodology } from './product-methodology';
import { ProductType } from './product-type';
import { Product } from './product.dto';

@InputType()
export abstract class ProductFilters {
  @Field(() => ProductType, {
    description: 'Only products matching this type',
    nullable: true,
  })
  readonly type?: ProductType;

  @Field(() => ProductApproach, {
    description: 'Only products matching this approach',
    nullable: true,
  })
  readonly approach?: ProductApproach;

  @Field(() => ProductMethodology, {
    description: 'Only products matching this methodology',
    nullable: true,
  })
  readonly methodology?: ProductMethodology;
}

const defaultFilters = {};

@InputType()
export class ProductListInput extends SortablePaginationInput<keyof Product>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ProductListInput();

  @Field({ nullable: true })
  @Type(() => ProductFilters)
  @ValidateNested()
  readonly filter: ProductFilters = defaultFilters;
}

@ObjectType()
export class ProductListOutput extends PaginatedList(Product) {}

@ObjectType({
  description: SecuredList.descriptionFor('product objects'),
})
export abstract class SecuredProductList extends SecuredList(Product) {}
