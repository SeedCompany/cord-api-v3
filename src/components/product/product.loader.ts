import { ID, ObjectView } from '../../common';
import { LoaderFactory, ObjectViewAwareLoader } from '../../core';
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
export class ProductLoader extends ObjectViewAwareLoader<AnyProduct> {
  constructor(private readonly products: ProductService) {
    super();
  }

  async loadManyByView(ids: readonly ID[], view: ObjectView) {
    return await this.products.readMany(ids, this.session, view);
  }
}
