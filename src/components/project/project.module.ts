import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { LocationModule } from '../location/location.module';
import { NotificationModule } from '../notifications';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectChangeRequestModule } from '../project-change-request/project-change-request.module';
import { UserModule } from '../user/user.module';
import { ProjectEngagementConnectionResolver } from './engagement-connection.resolver';
import { FinancialApproverModule } from './financial-approver/financial-approver.module';
import * as handlers from './handlers';
import { InternshipProjectResolver } from './internship-project.resolver';
import { RenameTranslationToMomentumMigration } from './migrations/rename-translation-to-momentum.migration';
import { ProjectMemberModule } from './project-member/project-member.module';
import {
  ConcreteRepos,
  ProjectEdgeDBRepository,
} from './project.edgedb.repository';
import { ProjectLoader } from './project.loader';
import { ProjectRepository } from './project.repository';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';
import { TranslationProjectResolver } from './translation-project.resolver';
import { ProjectUserConnectionResolver } from './user-connection.resolver';
import { ProjectWorkflowModule } from './workflow/project-workflow.module';

@Module({
  imports: [
    forwardRef(() => FieldRegionModule),
    ProjectMemberModule,
    forwardRef(() => BudgetModule),
    forwardRef(() => PartnershipModule),
    forwardRef(() => ProjectChangeRequestModule),
    forwardRef(() => UserModule),
    forwardRef(() => LocationModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => AuthorizationModule),
    PartnerModule,
    forwardRef(() => OrganizationModule),
    forwardRef(() => NotificationModule),
    FinancialApproverModule,
    ProjectWorkflowModule,
  ],
  providers: [
    ProjectResolver,
    TranslationProjectResolver,
    InternshipProjectResolver,
    ProjectEngagementConnectionResolver,
    ProjectUserConnectionResolver,
    ProjectService,
    splitDb(ProjectRepository, ProjectEdgeDBRepository),
    ...Object.values(ConcreteRepos),
    ProjectLoader,
    ...Object.values(handlers),
    RenameTranslationToMomentumMigration,
  ],
  exports: [ProjectService, ProjectMemberModule],
})
export class ProjectModule {}
