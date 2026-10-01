import { forwardRef, Module } from '@nestjs/common';
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
import { SystemAgentRepository } from './system-agent.repository';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { UserMutationActorResolver } from './user-mutation-actor.resolver';
import { UserMutationSubscriptionsResolver } from './user-mutation-subscriptions.resolver';
import { UserUpdateLinksResolver } from './user-update-links.resolver';
import { UserUpdatedResolver } from './user-updated.resolver';
import { UserChannels } from './user.channels';
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
    UserMutationSubscriptionsResolver,
    UserMutationActorResolver,
    UserUpdatedResolver,
    UserUpdateLinksResolver,
    AssignableRolesResolver,
    UserLoader,
    ActorLoader,
    UserService,
    UserChannels,
    UserRepository,
    KnownLanguageRepository,
    SystemAgentRepository,
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
