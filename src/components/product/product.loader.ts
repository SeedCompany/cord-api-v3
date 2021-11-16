import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { SingleItemLoader } from '../../core';
import { AnyProduct } from './dto';
import { ProductService } from './product.service';

@Injectable({ scope: Scope.REQUEST })
export class ProductLoader extends SingleItemLoader<AnyProduct> {
  constructor(private readonly products: ProductService) {
    super();
  }

  async loadOne(id: ID) {
    return await this.products.readOne(id, this.session);
  }
}
