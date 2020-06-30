import { forwardRef, Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { LocationModule } from '../location/location.module';
import { OrganizationService } from '../organization';
import { PartnershipModule } from '../partnership/partnership.module';
import { UserModule } from '../user/user.module';
import {
  InternshipProjectResolver,
  TranslationProjectResolver,
} from './project-lazy-fields.resolver';
import { ProjectMemberModule } from './project-member/project-member.module';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
  imports: [
    ProjectMemberModule,
    forwardRef(() => BudgetModule),
    forwardRef(() => PartnershipModule),
    UserModule,
    LocationModule,
    FileModule,
    EngagementModule,
  ],
  providers: [
    ProjectResolver,
    TranslationProjectResolver,
    InternshipProjectResolver,
    OrganizationService,
    ProjectService,
  ],
  exports: [ProjectService, ProjectMemberModule],
})
export class ProjectModule {}
