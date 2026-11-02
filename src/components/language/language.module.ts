import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { LocationModule } from '../location/location.module';
import { ProjectModule } from '../project/project.module';
import { EthnologueLanguageService } from './ethnologue-language';
import { EthnologueLanguageRepository } from './ethnologue-language/ethnologue-language.repository';
import { InternalFirstScriptureResolver } from './internal-first-scripture.resolver';
import { LanguageMutationActorResolver } from './language-mutation-actor.resolver';
import { LanguageMutationSubscriptionsResolver } from './language-mutation-subscriptions.resolver';
import { LanguageUpdateLinksResolver } from './language-update-links.resolver';
import { LanguageUpdatedResolver } from './language-updated.resolver';
import { LanguageChannels } from './language.channels';
import { LanguageLoader } from './language.loader';
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
    LanguageMutationSubscriptionsResolver,
    LanguageMutationActorResolver,
    LanguageUpdateLinksResolver,
    LanguageUpdatedResolver,
    LanguageService,
    LanguageChannels,
    EthnologueLanguageService,
    EthnologueLanguageRepository,
    LanguageRepository,
    LanguageLoader,
    InternalFirstScriptureResolver,
  ],
  exports: [LanguageService],
})
export class LanguageModule {}
