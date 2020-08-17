import { forwardRef, Module } from '@nestjs/common';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { MarketingLocationModule } from '../marketing-location/marketing-location.module';
import { ProjectModule } from '../project/project.module';
import { RegistryOfGeographyModule } from '../registry-of-geography/registry-of-geography.module';
import { UserModule } from '../user/user.module';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';
import { RegionResolver } from './region.resolver';
import { ZoneResolver } from './zone.resolver';

@Module({
  imports: [UserModule],
  providers: [LocationResolver, RegionResolver, LocationService, ZoneResolver],
  exports: [LocationService],
})
export class LocationModule {}
