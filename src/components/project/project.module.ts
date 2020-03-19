import { Module } from '@nestjs/common';
import { InternshipProjectResolver } from './internship-project.resolver';
import { ProjectMemberModule } from './project-member';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';
import { TranslationProjectResolver } from './translation-project.resolver';

@Module({
  imports: [ProjectMemberModule],
  providers: [
    ProjectResolver,
    TranslationProjectResolver,
    InternshipProjectResolver,
    ProjectService,
  ],
  exports: [ProjectService, ProjectMemberModule],
})
export class ProjectModule {}
