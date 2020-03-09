import { Module } from '@nestjs/common';
import { EducationResolver } from './education.resolver';
import { EducationService } from './education.service';

@Module({
  providers: [EducationResolver, EducationService],
  exports: [EducationService],
})
export class EducationModule {}
