import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LanguageModule } from '../language/language.module';
import { PartnerModule } from '../partner/partner.module';
import { SearchRepository } from './search.repository';
import { SearchResolver } from './search.resolver';
import { SearchService } from './search.service';

@Module({
  imports: [PartnerModule, AuthorizationModule, LanguageModule],
  providers: [SearchResolver, SearchService, SearchRepository],
  exports: [SearchService],
})
export class SearchModule {}
