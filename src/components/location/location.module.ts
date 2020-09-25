import { Module } from '@nestjs/common';
import { LocationResolver } from './location.resolver';
import { LocationService } from './location.service';

@Module({
  providers: [LocationResolver, LocationService],
  exports: [LocationService],
})
export class LocationModule {}
