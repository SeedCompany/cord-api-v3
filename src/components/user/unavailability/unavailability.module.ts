import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { UnavailabilityResolver } from './unavailability.resolver';
import { UnavailabilityService } from './unavailability.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [UnavailabilityResolver, UnavailabilityService],
  exports: [UnavailabilityService],
})
export class UnavailabilityModule {}
