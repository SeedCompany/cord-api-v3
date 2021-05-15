import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { EducationResolver } from './education.resolver';
import { EducationService } from './education.service';
import { EducationRepository } from './education.repository';

@Module({
  imports: [forwardRef(() => AuthorizationModule)],
  providers: [EducationResolver, EducationService, EducationRepository],
  exports: [EducationService, EducationRepository],
})
export class EducationModule {}
