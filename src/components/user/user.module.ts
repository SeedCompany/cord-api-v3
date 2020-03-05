import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization';
import { EducationModule } from './education';
import { UnavailabilityModule } from './unavailability';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';


@Module({
  imports: [
    OrganizationModule,
    EducationModule,
    UnavailabilityModule,
  ],
  providers: [
    UserResolver,
    UserService,
  ],
  exports: [
    UserService,
    EducationModule,
    UnavailabilityModule,
  ],
})
export class UserModule {}
