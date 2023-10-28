import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
import { ScriptureModule } from '../scripture';
import { StoryModule } from '../story/story.module';
import * as handlers from './handlers';
import { FixNaNTotalVerseEquivalentsMigration } from './migrations/fix-nan-total-verse-equivalents.migration';
import { ProducibleResolver } from './producible.resolver';
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
    ProducibleResolver,
    ProductLoader,
    ProductService,
    ProductRepository,
    ProductExtractor,
    FixNaNTotalVerseEquivalentsMigration,
    ...Object.values(handlers),
  ],
  exports: [ProductService],
})
export class ProductModule {}
