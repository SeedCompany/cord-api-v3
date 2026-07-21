import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
import { PnpExtractionResultModule } from '../pnp/extraction-result/pnp-extraction-result.module';
import { ScriptureModule } from '../scripture';
import { StoryModule } from '../story/story.module';
import * as handlers from './handlers';
import { BackfillEmptyMediumsMigration } from './migrations/backfill-empty-mediums.migration';
import { FixNaNTotalVerseEquivalentsMigration } from './migrations/fix-nan-total-verse-equivalents.migration';
import { PnpProductSyncService } from './pnp-product-sync.service';
import { ProducibleResolver } from './producible.resolver';
import { ProductMutationLinksResolver } from './product-mutation-links.resolver';
import { ProductMutationSubscriptionsResolver } from './product-mutation-subscriptions.resolver';
import { ProductUpdatedResolver } from './product-updated.resolver';
import { ProductChannels } from './product.channels';
import { ProductDrizzleRepository } from './product.drizzle.repository';
import { ProductExtractor } from './product.extractor';
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
    PnpExtractionResultModule,
  ],
  providers: [
    ProductResolver,
    ProductMutationSubscriptionsResolver,
    ProductUpdatedResolver,
    ProductMutationLinksResolver,
    ProducibleResolver,
    ProductLoader,
    ProductService,
    ProductChannels,
    splitDb(ProductRepository, {
      // migration-todo: `as any` removed at Phase 7 cutover when splitDb
      // disappears with the Neo4j path.
      postgres: ProductDrizzleRepository as any,
    }),
    ProductExtractor,
    PnpProductSyncService,
    FixNaNTotalVerseEquivalentsMigration,
    BackfillEmptyMediumsMigration,
    ...Object.values(handlers),
  ],
  exports: [ProductService, PnpProductSyncService],
})
export class ProductModule {}
