import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { OrganizationService } from '../organization';
import { PartnerModule } from '../partner/partner.module';
import { PartnershipModule } from '../partnership/partnership.module';
import { UserModule } from '../user/user.module';
import * as handlers from './handlers';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectStepResolver } from './project-step.resolver';
import { ProjectResolver } from './project.resolver';
import { ProjectRules } from './project.rules';
import { ProjectService } from './project.service';

@Module({
  imports: [
    FieldRegionModule,
    ProjectMemberModule,
    forwardRef(() => BudgetModule),
    forwardRef(() => PartnershipModule),
    forwardRef(() => UserModule),
    LocationModule,
    FileModule,
    EngagementModule,
    forwardRef(() => AuthorizationModule),
    PartnerModule,
  ],
  providers: [
    ProjectResolver,
    OrganizationService,
    ProjectService,
    ProjectStepResolver,
    ProjectRules,
    ...Object.values(handlers),
  ],
  exports: [ProjectService, ProjectMemberModule],
})
export class ProjectModule {}
