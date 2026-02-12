import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import {
  type ProductUpdate,
  ProductUpdated,
} from './dto/product-mutations.dto';

@Resolver(ProductUpdated)
export class ProductUpdatedResolver {
  @ResolveField(() => [String], {
    description: stripIndent`
      A list of keys of the \`ProductUpdate\` object which have been updated.

      This can be used to determine which fields have been updated, since
      GQL cannot distinguish between omitted fields and explicit nulls.
    `,
  })
  updatedKeys(
    @Parent() { updated }: ProductUpdated,
  ): ReadonlyArray<keyof ProductUpdate> {
    return keys(updated);
  }
}
