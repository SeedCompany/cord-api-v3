import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget';
import { LocationModule } from '../location';
import { OrganizationService } from '../organization';
import { EducationModule, UnavailabilityModule, UserModule } from '../user';
import {
  InternshipProjectResolver,
  TranslationProjectResolver,
} from './project-lazy-fields.resolver';
import { ProjectMemberModule } from './project-member';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
  imports: [
    BudgetModule,
    ProjectMemberModule,
    EducationModule,
    UserModule,
    UnavailabilityModule,
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
