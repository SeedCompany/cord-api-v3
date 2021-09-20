import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Product } from './dto';
import { ProductService } from './product.service';

@Injectable({ scope: Scope.REQUEST })
export class ProductLoader extends OrderedNestDataLoader<Product> {
  constructor(private readonly products: ProductService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.products.readMany(ids, this.session);
  }
}
