import { Module } from '@nestjs/common';
import { UnavailabilityResolver } from './unavailability.resolver';
import { UnavailabilityService } from './unavailability.service';

@Module({
  providers: [UnavailabilityResolver, UnavailabilityService],
  exports: [UnavailabilityService],
})
export class UnavailabilityModule {}
