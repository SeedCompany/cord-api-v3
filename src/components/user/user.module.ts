import { forwardRef, Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication';
import { AuthorizationModule } from '../authorization';
import { OrganizationModule } from '../organization';
import { EducationModule } from './education';
import { UnavailabilityModule } from './unavailability';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [
    forwardRef(() => AuthenticationModule),
    AuthorizationModule,
    EducationModule,
    OrganizationModule,
    UnavailabilityModule,
  ],
  providers: [UserResolver, UserService],
  exports: [UserService, EducationModule, UnavailabilityModule],
})
export class UserModule {}
