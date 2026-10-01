import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UnavailabilityLoader } from './unavailability.loader';
import { UnavailabilityRepository } from './unavailability.repository';
import { UnavailabilityResolver } from './unavailability.resolver';
import { UnavailabilityService } from './unavailability.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    UnavailabilityResolver,
    UnavailabilityService,
    UnavailabilityRepository,
    UnavailabilityLoader,
  ],
  exports: [UnavailabilityService],
})
export class UnavailabilityModule {}
