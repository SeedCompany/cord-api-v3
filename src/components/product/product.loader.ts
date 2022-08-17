import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import {
  AnyProduct,
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
export class ProductLoader extends OrderedNestDataLoader<AnyProduct> {
  constructor(private readonly products: ProductService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.products.readMany(ids, this.session);
  }
}
