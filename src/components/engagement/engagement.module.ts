import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyModule } from '../ceremony/ceremony.module';
import { FileModule } from '../file/file.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { ProductModule } from '../product/product.module';
import { ProjectModule } from '../project/project.module';
import { EngagementMutationLinksResolver } from './engagement-mutation-links.resolver';
import { EngagementMutationSubscriptionsResolver } from './engagement-mutation-subscriptions.resolver';
import { EngagementStatusResolver } from './engagement-status.resolver';
import {
  InternshipEngagementUpdateLinksResolver,
  LanguageEngagementUpdateLinksResolver,
} from './engagement-update-links.resolver';
import { EngagementUpdatedResolver } from './engagement-updated.resolver';
import { EngagementChannels } from './engagement.channels';
import { EngagementGelRepository } from './engagement.gel.repository';
import { EngagementLoader } from './engagement.loader';
import { EngagementRepository } from './engagement.repository';
import { EngagementResolver } from './engagement.resolver';
import { EngagementRules } from './engagement.rules';
import { EngagementService } from './engagement.service';
import * as handlers from './handlers';
import { InternshipEngagementResolver } from './internship-engagement.resolver';
import { InternshipPositionResolver } from './internship-position.resolver';
import { LanguageEngagementResolver } from './language-engagement.resolver';
import { AddAiAssistFlagMigration } from './migrations/add-ai-assist-flag.migration';
import { AddMarketableMigration } from './migrations/add-marketable.migration';
import { FixNullMethodologiesMigration } from './migrations/fix-null-methodologies.migration';
import { RenameMilestoneReachedToMilestonePlannedMigration } from './migrations/rename-milestoneReached-to-milestonePlanned.migration';
import { EngagementProductConnectionResolver } from './product-connection.resolver';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => FileModule),
    CeremonyModule,
    ProductModule,
    forwardRef(() => LanguageModule),
    forwardRef(() => LocationModule),
    forwardRef(() => ProjectModule),
  ],
  providers: [
    EngagementResolver,
    EngagementMutationSubscriptionsResolver,
    EngagementUpdatedResolver,
    EngagementMutationLinksResolver,
    LanguageEngagementUpdateLinksResolver,
    InternshipEngagementUpdateLinksResolver,
    LanguageEngagementResolver,
    InternshipEngagementResolver,
    EngagementStatusResolver,
    InternshipPositionResolver,
    EngagementProductConnectionResolver,
    EngagementRules,
    EngagementService,
    EngagementChannels,
    splitDb(EngagementRepository, EngagementGelRepository),
    EngagementLoader,
    ...Object.values(handlers),
    FixNullMethodologiesMigration,
    AddAiAssistFlagMigration,
    AddMarketableMigration,
    RenameMilestoneReachedToMilestonePlannedMigration,
  ],
  exports: [EngagementService, EngagementRepository],
})
export class EngagementModule {}
