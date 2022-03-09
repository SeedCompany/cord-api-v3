import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { LocationLoader } from './location.loader';
import { PgLocationRepository } from './location.pg.repository';
import { LocationRepository } from './location.repository';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => FundingAccountModule),
    FieldRegionModule,
  ],
  providers: [
    LocationResolver,
    LocationService,
    LocationRepository,
    LocationLoader,
    splitDb(LocationRepository, PgLocationRepository),
  ],
  exports: [LocationService],
})
export class LocationModule {}
