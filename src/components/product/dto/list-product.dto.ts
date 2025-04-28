import { InputType, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  FilterField,
  ID,
  OptionalField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { ProductApproach } from './product-approach.enum';
import { ProductMethodology } from './product-methodology.enum';
import { AnyProduct, Product } from './product.dto';

@InputType()
export abstract class ProductFilters {
  @OptionalField(() => ProductApproach, {
    description: 'Only products matching this approach',
  })
  readonly approach?: ProductApproach;

  @OptionalField(() => ProductMethodology, {
    description: 'Only products matching this methodology',
  })
  readonly methodology?: ProductMethodology;

  @OptionalField({
    description: stripIndent`
      Only products that are (or not) placeholders.
      This is based on the \`placeholderDescription\` field.
    `,
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
