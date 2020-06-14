import { Module } from '@nestjs/common';
import { EducationResolver } from './education.resolver';
import { EducationService } from './education.service';
import { QueryModule } from '../../../core/query/query.module';

@Module({
  imports: [QueryModule],
  providers: [EducationResolver, EducationService],
  exports: [EducationService],
})
export class EducationModule {}
