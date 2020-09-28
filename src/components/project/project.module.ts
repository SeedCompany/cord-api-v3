import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FieldRegionModule } from '../field-region/field-region.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { OrganizationService } from '../organization';
import { PartnershipModule } from '../partnership/partnership.module';
import { UserModule } from '../user/user.module';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
  imports: [
    FieldRegionModule,
    ProjectMemberModule,
    forwardRef(() => BudgetModule),
    forwardRef(() => PartnershipModule),
    UserModule,
    LocationModule,
    FileModule,
    EngagementModule,
    AuthorizationModule,
  ],
  providers: [ProjectResolver, OrganizationService, ProjectService],
  exports: [ProjectService, ProjectMemberModule],
})
export class ProjectModule {}
