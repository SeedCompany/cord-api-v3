import { Module } from '@nestjs/common';
import { PartnerModule } from '../partner/partner.module';
import { SearchRepository } from './search.repository';
import { SearchResolver } from './search.resolver';
import { SearchService } from './search.service';

@Module({
  imports: [PartnerModule],
  providers: [SearchResolver, SearchService, SearchRepository],
  exports: [SearchService],
})
export class SearchModule {}
