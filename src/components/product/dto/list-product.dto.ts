import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { ProductApproach } from './product-approach.enum';
import { ProductMethodology } from './product-methodology.enum';
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

@InputType()
export class ProductListInput extends SortablePaginationInput<keyof Product>({
  defaultSort: 'createdAt',
}) {
  @FilterField(() => ProductFilters)
  readonly filter?: ProductFilters;
}

@ObjectType()
export class ProductListOutput extends PaginatedList<Product, AnyProduct>(
  Product,
) {}

@ObjectType({
  description: SecuredList.descriptionFor('products'),
})
export abstract class SecuredProductList extends SecuredList<
  Product,
  AnyProduct
>(Product) {}
