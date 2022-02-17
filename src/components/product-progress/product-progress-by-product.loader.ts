import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { LoaderOptionsOf, OrderedNestDataLoader } from '../../core';
import { Product } from '../product';
import { ProductProgress } from './dto';
import { ProductProgressService } from './product-progress.service';

@Injectable({ scope: Scope.REQUEST })
export class ProductProgressByProductLoader extends OrderedNestDataLoader<
  { product: Product; progress: readonly ProductProgress[] },
  Product,
  ID
> {
  constructor(private readonly service: ProductProgressService) {
    super();
  }

  getOptions(): LoaderOptionsOf<ProductProgressByProductLoader> {
    return {
      ...super.getOptions(),
      propertyKey: (result) => result.product,
      cacheKeyFn: (report) => report.id,
    };
  }

  async loadMany(products: readonly Product[]) {
    return await this.service.readAllForManyProducts(products, this.session);
  }
}
