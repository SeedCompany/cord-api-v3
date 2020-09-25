import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';
import { RegionResolver } from './region.resolver';
import { ZoneResolver } from './zone.resolver';

@Module({
  imports: [AuthorizationModule, UserModule],
  providers: [LocationResolver, RegionResolver, LocationService, ZoneResolver],
  exports: [LocationService],
})
export class LocationModule {}
