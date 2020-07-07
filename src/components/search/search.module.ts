import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { SearchResolver } from './search.resolver';
import { SearchService } from './search.service';

@Module({
  imports: [OrganizationModule],
  providers: [SearchResolver, SearchService],
  exports: [SearchService],
})
export class SearchModule {}
