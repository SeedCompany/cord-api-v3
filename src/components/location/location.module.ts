import { Module } from '@nestjs/common';
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
