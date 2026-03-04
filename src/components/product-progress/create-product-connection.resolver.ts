import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Variant } from '~/common';
import { Identity } from '~/core/authentication';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ProductCreated } from '../product/dto/product-mutations.dto';
import { ProductLoader } from '../product/product.loader';
import { ProductProgressService } from './product-progress.service';

@Resolver(() => ProductCreated)
export class ProgressReportCreateProductConnectionResolver {
  constructor(
    private readonly service: ProductProgressService,
    private readonly identity: Identity,
  ) {}

  @ResolveField(() => [Variant], {
    description: 'All available progress variants for this product',
  })
  async availableVariants(
    @Parent() { productId }: ProductCreated,
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>,
  ): Promise<readonly Variant[]> {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return [];
    }
    const product = await products.load(productId);
    return await this.service.getAvailableVariantsForProduct(product);
  }
}
