import { forwardRef, Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { ProjectModule } from '../project/project.module';
import { EthnologueLanguageService } from './ethnologue-language';
import { LanguageResolver } from './language.resolver';
import { LanguageService } from './language.service';

@Module({
  imports: [LocationModule, forwardRef(() => ProjectModule)],
  providers: [LanguageResolver, LanguageService, EthnologueLanguageService],
  exports: [LanguageService],
})
export class LanguageModule {}
