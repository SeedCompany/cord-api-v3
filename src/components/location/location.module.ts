import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';
import { LocationRepository } from './location.repository';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => FundingAccountModule),
    FieldRegionModule,
  ],
  providers: [LocationResolver, LocationService, LocationRepository],
  exports: [LocationService, LocationRepository],
})
export class LocationModule {}
