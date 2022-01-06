import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
import { ScriptureModule } from '../scripture/scripture.module';
import { StoryModule } from '../story/story.module';
import * as handlers from './handlers';
import * as migrations from './migrations';
import { ProductExtractor } from './product-extractor.service';
import { ProductLoader } from './product.loader';
import { ProductRepository } from './product.repository';
import { ProductResolver } from './product.resolver';
import { ProductService } from './product.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    ScriptureModule,
    FileModule,
    StoryModule,
  ],
  providers: [
    ProductResolver,
    ProductService,
    ProductRepository,
    ProductLoader,
    ProductExtractor,
    ...Object.values(handlers),
    ...Object.values(migrations),
  ],
  exports: [ProductService],
})
export class ProductModule {}
