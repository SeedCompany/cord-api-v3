import { Module } from '@nestjs/common';
import { InternshipProjectResolver } from './internship-project.resolver';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';
import { TranslationProjectResolver } from './translation-project.resolver';

@Module({
  providers: [
    ProjectResolver,
    TranslationProjectResolver,
    InternshipProjectResolver,
    ProjectService,
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
