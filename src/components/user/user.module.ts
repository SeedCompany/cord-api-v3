import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../authentication';
import { AuthorizationModule } from '../authorization';
import { OrganizationModule } from '../organization';
import { EducationModule } from './education';
import { UnavailabilityModule } from './unavailability';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';
import { QueryModule } from '../../core/query/query.module';

@Module({
  imports: [
    AuthenticationModule,
    AuthorizationModule,
    EducationModule,
    OrganizationModule,
    UnavailabilityModule,
    QueryModule,
  ],
  providers: [UserResolver, UserService],
  exports: [UserService, EducationModule, UnavailabilityModule],
})
export class UserModule {}
