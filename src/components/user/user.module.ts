import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization';
import { UnavailabilityModule } from './unavailability';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [
    OrganizationModule,
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
