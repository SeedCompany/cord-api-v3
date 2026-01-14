import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import {
  type ProgressVariantByProductInput,
  type ProgressVariantByProductOutput,
} from './dto';
import { ProductProgressService } from './product-progress.service';

@LoaderFactory()
export class ProductProgressByProductLoader implements DataLoaderStrategy<
  ProgressVariantByProductOutput,
  ProgressVariantByProductInput,
  string
> {
  constructor(private readonly service: ProductProgressService) {}

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
    return await this.service.readAllForManyProducts(products);
  }
}
