import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget';
import { LocationModule } from '../location';
import { OrganizationService } from '../organization';
import { PartnershipModule } from '../partnership';
import { UserModule } from '../user';
import {
  InternshipProjectResolver,
  TranslationProjectResolver,
} from './project-lazy-fields.resolver';
import { ProjectMemberModule } from './project-member';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
  imports: [
    ProjectMemberModule,
    BudgetModule,
    PartnershipModule,
    UserModule,
    LocationModule,
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
