import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UnavailabilityDrizzleRepository } from './unavailability.drizzle.repository';
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
    splitDb(UnavailabilityRepository, {
      gel: UnavailabilityGelRepository,
      // migration-todo: remove `as any` once splitDb types accept drizzle repos directly
      postgres: UnavailabilityDrizzleRepository as any,
    }),
    UnavailabilityLoader,
  ],
  exports: [UnavailabilityService],
})
export class UnavailabilityModule {}
