import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { TimeZoneModule } from '../timezone';
import { ActorLoader } from './actor.loader';
import { AssignableRolesResolver } from './assignable-roles.resolver';
import { EducationModule } from './education/education.module';
import { KnownLanguageRepository } from './known-language.repository';
import { KnownLanguageResolver } from './known-language.resolver';
import { AddActorLabelMigration } from './migrations/add-actor-label.migration';
import { AddUserNameLabelMigration } from './migrations/add-user-name-label.migration';
import { SystemAgentEdgeDBRepository } from './system-agent.edgedb.repository';
import { SystemAgentNeo4jRepository } from './system-agent.neo4j.repository';
import { SystemAgentRepository } from './system-agent.repository';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { UserEdgeDBRepository } from './user.edgedb.repository';
import { UserLoader } from './user.loader';
import { UserRepository } from './user.repository';
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
    forwardRef(() => LocationModule),
    forwardRef(() => LanguageModule),
  ],
  providers: [
    KnownLanguageResolver,
    UserResolver,
    AssignableRolesResolver,
    UserLoader,
    ActorLoader,
    UserService,
    splitDb(UserRepository, UserEdgeDBRepository),
    KnownLanguageRepository,
    {
      ...splitDb(SystemAgentNeo4jRepository, SystemAgentEdgeDBRepository),
      provide: SystemAgentRepository,
    },
    AddActorLabelMigration,
    AddUserNameLabelMigration,
  ],
  exports: [
    UserService,
    UserRepository,
    SystemAgentRepository,
    EducationModule,
    UnavailabilityModule,
  ],
})
export class UserModule {}
