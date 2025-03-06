import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UnavailabilityGelRepository } from './unavailability.gel.repository';
import { UnavailabilityLoader } from './unavailability.loader';
import { UnavailabilityRepository } from './unavailability.repository';
import { UnavailabilityResolver } from './unavailability.resolver';
import { UnavailabilityService } from './unavailability.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    UnavailabilityResolver,
    UnavailabilityService,
    splitDb(UnavailabilityRepository, UnavailabilityGelRepository),
    UnavailabilityLoader,
  ],
  exports: [UnavailabilityService],
})
export class UnavailabilityModule {}
