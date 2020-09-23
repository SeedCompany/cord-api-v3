import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { LocationModule } from '../location/location.module';
import { ProjectModule } from '../project/project.module';
import { EthnologueLanguageService } from './ethnologue-language';
import { LanguageResolver } from './language.resolver';
import { LanguageService } from './language.service';

@Module({
  imports: [
    AuthorizationModule,
    LocationModule,
    forwardRef(() => ProjectModule),
  ],
  providers: [LanguageResolver, LanguageService, EthnologueLanguageService],
  exports: [LanguageService],
})
export class LanguageModule {}
