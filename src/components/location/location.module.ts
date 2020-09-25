import { Module } from '@nestjs/common';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';

@Module({
  imports: [FundingAccountModule],
  providers: [LocationResolver, LocationService],
  exports: [LocationService],
})
export class LocationModule {}
