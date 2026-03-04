import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { type AnyProduct, Product } from './dto';
import { ProductMutation } from './dto/product-mutations.dto';
import { ProductLoader } from './product.loader';

@Resolver(ProductMutation)
export class ProductMutationLinksResolver {
  @ResolveField(() => Product)
  async product(
    @Parent() change: ProductMutation,
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>,
  ): Promise<AnyProduct> {
    return await products.load(change.productId);
  }
}
