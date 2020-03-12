import { Module } from '@nestjs/common';
import { EducationModule } from './education';
import { OrganizationModule } from '../organization';
import { UnavailabilityModule } from './unavailability';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [EducationModule, OrganizationModule, UnavailabilityModule],
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
