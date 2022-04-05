import { forwardRef, Module } from '@nestjs/common';
import { UnavailabilityLoader } from '.';
import { splitDb } from '../../../core';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UnavailabilityPgRepository } from './unavailability.pg.repository';
import { UnavailabilityRepository } from './unavailability.repository';
import { UnavailabilityResolver } from './unavailability.resolver';
import { UnavailabilityService } from './unavailability.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    UnavailabilityResolver,
    splitDb(UnavailabilityRepository, UnavailabilityPgRepository),
    UnavailabilityService,
    UnavailabilityLoader,
  ],
  exports: [UnavailabilityService],
})
export class UnavailabilityModule {}
