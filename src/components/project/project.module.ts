import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectChangeRequestModule } from '../project-change-request/project-change-request.module';
import { UserModule } from '../user/user.module';
import { ProjectEngagementConnectionResolver } from './engagement-connection.resolver';
import * as handlers from './handlers';
import { InternshipProjectResolver } from './internship-project.resolver';
import * as migrations from './migrations';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectStepResolver } from './project-step.resolver';
import { ProjectLoader } from './project.loader';
import { ProjectRepository } from './project.repository';
import { ProjectResolver } from './project.resolver';
import { ProjectRules } from './project.rules';
import { ProjectService } from './project.service';
import { TranslationProjectResolver } from './translation-project.resolver';
import { ProjectUserConnectionResolver } from './user-connection.resolver';

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
  ],
  providers: [
    ProjectResolver,
    TranslationProjectResolver,
    InternshipProjectResolver,
    ProjectEngagementConnectionResolver,
    ProjectUserConnectionResolver,
    ProjectService,
    ProjectStepResolver,
    ProjectRules,
    ProjectRepository,
    ProjectLoader,
    ...Object.values(handlers),
    ...Object.values(migrations),
  ],
  exports: [ProjectService, ProjectMemberModule, ProjectRules],
})
export class ProjectModule {}
