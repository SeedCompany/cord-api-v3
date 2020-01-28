import { Module } from '@nestjs/common';
import { UnavailabilityModule } from './unavailability';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [
    UnavailabilityModule,
  ],
  providers: [
    UserResolver,
    UserService,
  ],
  exports: [
    UserService,
    UnavailabilityModule,
  ],
})
export class UserModule {}
