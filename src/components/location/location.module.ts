import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { FileModule } from '../file/file.module';
import { FundingAccountModule } from '../funding-account/funding-account.module';
import { LocationGelRepository } from './location.gel.repository';
import { LocationLoader } from './location.loader';
import { LocationRepository } from './location.repository';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';
import { DefaultMarketingRegionMigration } from './migrations/default-marketing-region.migration';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => FundingAccountModule),
    FieldRegionModule,
    FileModule,
  ],
  providers: [
    LocationResolver,
    LocationService,
    splitDb(LocationRepository, LocationGelRepository),
    LocationLoader,
    DefaultMarketingRegionMigration,
  ],
  exports: [LocationService],
})
export class LocationModule {}
