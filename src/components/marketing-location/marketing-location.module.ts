import { Module } from '@nestjs/common';
import { MarketingLocationResolver } from './marketing-location.resolver';
import { MarketingLocationService } from './marketing-location.service';

@Module({
  providers: [MarketingLocationResolver, MarketingLocationService],
  exports: [MarketingLocationService],
})
export class MarketingLocationModule {}
