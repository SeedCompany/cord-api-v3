import { forwardRef, Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { TimeZoneModule } from '../timezone';
import { EducationModule } from './education/education.module';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [
    forwardRef(() => AuthenticationModule),
    forwardRef(() => AuthorizationModule),
    EducationModule,
    forwardRef(() => OrganizationModule),
    UnavailabilityModule,
    TimeZoneModule,
    LocationModule,
  ],
  providers: [UserResolver, UserService],
  exports: [UserService, EducationModule, UnavailabilityModule],
})
export class UserModule {}
