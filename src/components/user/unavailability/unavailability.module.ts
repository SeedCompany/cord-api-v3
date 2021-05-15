import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UnavailabilityResolver } from './unavailability.resolver';
import { UnavailabilityService } from './unavailability.service';
import { UnavailabilityRepository } from './unavailability.repository';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    UnavailabilityResolver,
    UnavailabilityService,
    UnavailabilityRepository,
  ],
  exports: [UnavailabilityService, UnavailabilityRepository],
})
export class UnavailabilityModule {}
