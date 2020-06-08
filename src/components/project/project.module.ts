import { Module } from '@nestjs/common';
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
    ProjectService,
  ],
  exports: [ProjectService, ProjectMemberModule],
})
export class ProjectModule {}
