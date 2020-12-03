import { forwardRef, Module } from '@nestjs/common';
import { DbV4 } from '../../core/database/v4/dbv4.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { TimeZoneModule } from '../timezone';
import { EducationModule } from './education/education.module';
import { KnownLanguageResolver } from './known-language.resolver';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [
    forwardRef(() => AuthenticationModule),
    forwardRef(() => AuthorizationModule),
    EducationModule,
    forwardRef(() => OrganizationModule),
    forwardRef(() => PartnerModule),
    UnavailabilityModule,
    TimeZoneModule,
    LocationModule,
    forwardRef(() => LanguageModule),
  ],
  providers: [KnownLanguageResolver, UserResolver, UserService, DbV4],
  exports: [UserService, EducationModule, UnavailabilityModule, DbV4],
})
export class UserModule {}
