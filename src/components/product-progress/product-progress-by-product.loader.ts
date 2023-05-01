import { LoaderFactory, LoaderOptionsOf, OrderedNestDataLoader } from '~/core';
import {
  ProgressVariantByProductInput,
  ProgressVariantByProductOutput,
} from './dto';
import { ProductProgressService } from './product-progress.service';

@LoaderFactory()
export class ProductProgressByProductLoader extends OrderedNestDataLoader<
  ProgressVariantByProductOutput,
  ProgressVariantByProductInput,
  string
> {
  constructor(private readonly service: ProductProgressService) {
    super();
  }

  getOptions() {
    return {
      propertyKey: (result) => ({
        product: result.product,
        variant: result.variant,
      }),
      cacheKeyFn: (args) => `${args.product.id}:${args.variant.key}`,
    } satisfies LoaderOptionsOf<ProductProgressByProductLoader>;
  }

  async loadMany(products: readonly ProgressVariantByProductInput[]) {
    return await this.service.readAllForManyProducts(products, this.session);
  }
}
