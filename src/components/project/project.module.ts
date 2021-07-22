import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { ProjectChangeRequestModule } from '../project-change-request/project-change-request.module';
import { UserModule } from '../user/user.module';
import { ProjectEngagementConnectionResolver } from './engagement-connection.resolver';
import * as handlers from './handlers';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectStepResolver } from './project-step.resolver';
import { ProjectRepository } from './project.repository';
import { ProjectResolver } from './project.resolver';
import { ProjectRules } from './project.rules';
import { ProjectService } from './project.service';

@Module({
  imports: [
    forwardRef(() => FieldRegionModule),
    ProjectMemberModule,
    forwardRef(() => BudgetModule),
    forwardRef(() => PartnershipModule),
    forwardRef(() => ProjectChangeRequestModule),
    forwardRef(() => UserModule),
    forwardRef(() => LocationModule),
    FileModule,
    forwardRef(() => EngagementModule),
    forwardRef(() => AuthorizationModule),
    PartnerModule,
    forwardRef(() => OrganizationModule),
  ],
  providers: [
    ProjectResolver,
    ProjectEngagementConnectionResolver,
    ProjectService,
    ProjectStepResolver,
    ProjectRules,
    ProjectRepository,
    ...Object.values(handlers),
  ],
  exports: [ProjectService, ProjectMemberModule, ProjectRules],
})
export class ProjectModule {}
