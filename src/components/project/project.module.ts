import { Module } from '@nestjs/common';
import { LocationService } from '../location';
import { OrganizationService } from '../organization';
import { EducationService, UnavailabilityService, UserService } from '../user';
import { InternshipProjectResolver } from './internship-project.resolver';
import { ProjectMemberModule } from './project-member';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';
import { TranslationProjectResolver } from './translation-project.resolver';

@Module({
  imports: [ProjectMemberModule],
  providers: [
    EducationService,
    LocationService,
    ProjectResolver,
    TranslationProjectResolver,
    InternshipProjectResolver,
    OrganizationService,
    ProjectService,
    UnavailabilityService,
    UserService,
  ],
  exports: [ProjectService, ProjectMemberModule],
})
export class ProjectModule {}
