import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LocationModule } from '../location/location.module';
import { ProjectModule } from '../project/project.module';
import { EthnologueLanguageService } from './ethnologue-language';
import { EthnologueLanguageGelRepository } from './ethnologue-language/ethnologue-language.gel.repository';
import { EthnologueLanguageRepository } from './ethnologue-language/ethnologue-language.repository';
import { InternalFirstScriptureResolver } from './internal-first-scripture.resolver';
import { LanguageGelRepository } from './language.gel.repository';
import { LanguageLoader } from './language.loader';
import { LanguageRepository } from './language.repository';
import { LanguageResolver } from './language.resolver';
import { LanguageService } from './language.service';
import { RegistryOfDialectToRegistryOfLanguageVarietiesMigration } from './migrations/rename-rod-to-rolv.migration';

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
    splitDb(EthnologueLanguageRepository, EthnologueLanguageGelRepository),
    splitDb(LanguageRepository, LanguageGelRepository),
    LanguageLoader,
    InternalFirstScriptureResolver,
    RegistryOfDialectToRegistryOfLanguageVarietiesMigration,
  ],
  exports: [LanguageService],
})
export class LanguageModule {}
