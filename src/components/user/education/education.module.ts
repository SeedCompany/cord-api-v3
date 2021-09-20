import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { EducationLoader } from './education.loader';
import { EducationRepository } from './education.repository';
import { EducationResolver } from './education.resolver';
import { EducationService } from './education.service';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [
    EducationResolver,
    EducationService,
    EducationRepository,
    EducationLoader,
  ],
  exports: [EducationService],
})
export class EducationModule {}
