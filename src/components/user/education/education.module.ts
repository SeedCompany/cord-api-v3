import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { EducationGelRepository } from './education.gel.repository';
import { EducationLoader } from './education.loader';
import { EducationRepository } from './education.repository';
import { EducationResolver } from './education.resolver';
import { EducationService } from './education.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    EducationResolver,
    EducationService,
    splitDb(EducationRepository, EducationGelRepository),
    EducationLoader,
  ],
  exports: [EducationService],
})
export class EducationModule {}
