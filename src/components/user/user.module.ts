import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
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
import { AddGenderAndPhotoMigration } from './migrations/add-photo-and-gender.migration';
import { AddUserNameLabelMigration } from './migrations/add-user-name-label.migration';
import { DefaultUserStatusMigration } from './migrations/default-user-status.migration';
import { SystemAgentGelRepository } from './system-agent.gel.repository';
import { SystemAgentNeo4jRepository } from './system-agent.neo4j.repository';
import { SystemAgentRepository } from './system-agent.repository';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { UserGelRepository } from './user.gel.repository';
import { UserLoader } from './user.loader';
import { UserRepository } from './user.repository';
import { UserResolver } from './user.resolver';
import { UserService } from './user.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    EducationModule,
    FileModule,
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
    splitDb(UserRepository, UserGelRepository),
    KnownLanguageRepository,
    {
      ...splitDb(SystemAgentNeo4jRepository, SystemAgentGelRepository),
      provide: SystemAgentRepository,
    },
    AddActorLabelMigration,
    AddUserNameLabelMigration,
    DefaultUserStatusMigration,
    AddGenderAndPhotoMigration,
  ],
  exports: [
    UserService,
    UserRepository,
    SystemAgentRepository,
    EducationModule,
    UnavailabilityModule,
    AddGenderAndPhotoMigration,
  ],
})
export class UserModule {}
