import { forwardRef, Module } from '@nestjs/common';
import { PostgresModule } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { LocationRepository } from './location.repository';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => FundingAccountModule),
    FieldRegionModule,
    PostgresModule,
  ],
  providers: [LocationResolver, LocationService, LocationRepository],
  exports: [LocationService],
})
export class LocationModule {}
