import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LocationModule } from '../location/location.module';
import { ProjectModule } from '../project/project.module';
import { EthnologueLanguageService } from './ethnologue-language';
import { PgEthnologueLanguageRepository } from './ethnologue-language/ethnologue-language.pg.repository';
import { EthnologueLanguageRepository } from './ethnologue-language/ethnologue-language.repository';
import { InternalFirstScriptureResolver } from './internal-first-scripture.resolver';
import { LanguageLoader } from './language.loader';
import { PgLanguageRepository } from './language.pg.repository';
import { LanguageRepository } from './language.repository';
import { LanguageResolver } from './language.resolver';
import { LanguageService } from './language.service';

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
    splitDb(EthnologueLanguageRepository, PgEthnologueLanguageRepository),
    splitDb(LanguageRepository, PgLanguageRepository),
    LanguageLoader,
    InternalFirstScriptureResolver,
  ],
  exports: [LanguageService],
})
export class LanguageModule {}
