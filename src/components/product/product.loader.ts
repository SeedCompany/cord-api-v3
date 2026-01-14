import { type ID } from '~/common';
import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import {
  type AnyProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  OtherProduct,
  Product,
} from './dto';
import { ProductService } from './product.service';

@LoaderFactory(() => [
  Product,
  DirectScriptureProduct,
  DerivativeScriptureProduct,
  OtherProduct,
])
export class ProductLoader implements DataLoaderStrategy<
  AnyProduct,
  ID<'Product'>
> {
  constructor(private readonly products: ProductService) {}

  async loadMany(ids: ReadonlyArray<ID<'Product'>>) {
    return await this.products.readMany(ids);
  }

  getOptions() {
    return {
      maxBatchSize: 25,
    } satisfies LoaderOptionsOf<ProductLoader>;
  }
}
