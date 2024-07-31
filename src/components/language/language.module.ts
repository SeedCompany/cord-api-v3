import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LocationModule } from '../location/location.module';
import { ProjectModule } from '../project/project.module';
import { EthnologueLanguageService } from './ethnologue-language';
import { EthnologueLanguageEdgeDBRepository } from './ethnologue-language/ethnologue-language.edgedb.repository';
import { EthnologueLanguageRepository } from './ethnologue-language/ethnologue-language.repository';
import { InternalFirstScriptureResolver } from './internal-first-scripture.resolver';
import { LanguageEdgeDBRepository } from './language.edgedb.repository';
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
    splitDb(EthnologueLanguageRepository, EthnologueLanguageEdgeDBRepository),
    splitDb(LanguageRepository, LanguageEdgeDBRepository),
    LanguageLoader,
    InternalFirstScriptureResolver,
    RegistryOfDialectToRegistryOfLanguageVarietiesMigration,
  ],
  exports: [LanguageService],
})
export class LanguageModule {}
