import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../../core';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { EducationLoader } from './education.loader';
import { EducationPgRepository } from './education.pg.repository';
import { EducationRepository } from './education.repository';
import { EducationResolver } from './education.resolver';
import { EducationService } from './education.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    EducationResolver,
    EducationService,
    splitDb(EducationRepository, EducationPgRepository),
    EducationLoader,
  ],
  exports: [EducationService],
})
export class EducationModule {}
