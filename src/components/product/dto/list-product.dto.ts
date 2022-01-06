import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { stripIndent } from 'common-tags';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { ProductApproach } from './product-approach';
import { ProductMethodology } from './product-methodology';
import { AnyProduct, Product } from './product.dto';

@InputType()
export abstract class ProductFilters {
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

  @Field({
    description: stripIndent`
      Only products that are (or not) placeholders.
      This is based on the \`placeholderDescription\` field.
    `,
    nullable: true,
  })
  readonly placeholder?: boolean;

  readonly engagementId?: ID;
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
export class ProductListOutput extends PaginatedList<Product, AnyProduct>(
  Product
) {}

@ObjectType({
  description: SecuredList.descriptionFor('products'),
})
export abstract class SecuredProductList extends SecuredList<
  Product,
  AnyProduct
>(Product) {}
