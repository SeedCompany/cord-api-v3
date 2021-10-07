import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ScriptureModule } from '../scripture/scripture.module';
import * as migrations from './migrations';
import { ProductLoader } from './product.loader';
import { ProductRepository } from './product.repository';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule), ScriptureModule],
  providers: [
    ProductResolver,
    ProductService,
    ProductRepository,
    ProductLoader,
    ...Object.values(migrations),
  ],
  exports: [ProductService],
})
export class ProductModule {}
