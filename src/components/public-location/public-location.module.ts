import { Module } from '@nestjs/common';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { LocationModule } from '../location/location.module';
import { MarketingLocationModule } from '../marketing-location/marketing-location.module';
import { PrivateLocationModule } from '../private-location/private-location.module';
import { RegistryOfGeographyModule } from '../registry-of-geography/registry-of-geography.module';
import { PublicLocationResolver } from './public-location.resolver';
import { PublicLocationService } from './public-location.service';

@Module({
  imports: [
    FundingAccountModule,
    LocationModule,
    MarketingLocationModule,
    RegistryOfGeographyModule,
    PrivateLocationModule,
  ],
  providers: [PublicLocationResolver, PublicLocationService],
  exports: [PublicLocationService],
})
export class PublicLocationModule {}
