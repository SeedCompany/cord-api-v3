import { Module } from '@nestjs/common';
import { LocationModule } from '../location';
import { OrganizationService } from '../organization';
import { EducationModule, UnavailabilityModule, UserModule } from '../user';
import { InternshipProjectResolver } from './internship-project.resolver';
import { ProjectMemberModule } from './project-member';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';
import { TranslationProjectResolver } from './translation-project.resolver';

@Module({
  imports: [
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
