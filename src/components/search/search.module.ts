import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LanguageModule } from '../language/language.module';
import { PartnerModule } from '../partner/partner.module';
import { SearchDrizzleRepository } from './search.drizzle.repository';
import { SearchRepository } from './search.repository';
import { SearchResolver } from './search.resolver';
import { SearchService } from './search.service';

@Module({
  imports: [PartnerModule, AuthorizationModule, LanguageModule],
  providers: [
    SearchResolver,
    SearchService,
    // migration-todo(cutover-cleanup): drop splitDb + the @ts-expect-error at
    // Phase 7 — SearchDrizzleRepository becomes the sole repo when the Neo4j
    // SearchRepository (and its OnIndex indexing hook) is removed.
    splitDb(SearchRepository, {
      // @ts-expect-error the postgres repo only implements search(); the
      // Neo4j-only OnIndex hook isn't needed under postgres.
      postgres: SearchDrizzleRepository,
    }),
  ],
  exports: [SearchService],
})
export class SearchModule {}
