import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LanguageModule } from '../language/language.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { AddPartnerApprovedProgramsMigration } from './migrations/add-partner-approved-programs.migration';
import { AddPartnerStartDateMigration } from './migrations/add-partner-start-date.migration';
import { PartnerGelRepository } from './partner.gel.repository';
import { PartnerLoader } from './partner.loader';
import { PartnerRepository } from './partner.repository';
import { PartnerResolver } from './partner.resolver';
import { PartnerService } from './partner.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => LanguageModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    PartnerResolver,
    PartnerService,
    splitDb(PartnerRepository, PartnerGelRepository),
    PartnerLoader,
    AddPartnerApprovedProgramsMigration,
    AddPartnerStartDateMigration,
  ],
  exports: [PartnerService],
})
export class PartnerModule {}
