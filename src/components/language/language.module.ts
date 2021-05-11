import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LocationModule } from '../location/location.module';
import { ProjectModule } from '../project/project.module';
import { EthnologueLanguageService } from './ethnologue-language';
import { LanguageResolver } from './language.resolver';
import { LanguageService } from './language.service';
import { LanguageRepository } from './language.repository';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => LocationModule),
    forwardRef(() => EngagementModule),
  ],
  providers: [
    LanguageResolver,
    LanguageService,
    EthnologueLanguageService,
    LanguageRepository,
  ],
  exports: [LanguageService, LanguageRepository],
})
export class LanguageModule {

  
}
