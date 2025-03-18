import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyModule } from '../ceremony/ceremony.module';
import { FileModule } from '../file/file.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { ProductModule } from '../product/product.module';
import { ProjectModule } from '../project/project.module';
import { EngagementStatusResolver } from './engagement-status.resolver';
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
import { AddMilestoneReachedMigration } from './migrations/add-milestone-reached.migration';
import { FixNullMethodologiesMigration } from './migrations/fix-null-methodologies.migration';
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
    LanguageEngagementResolver,
    InternshipEngagementResolver,
    EngagementStatusResolver,
    InternshipPositionResolver,
    EngagementProductConnectionResolver,
    EngagementRules,
    EngagementService,
    splitDb(EngagementRepository, EngagementGelRepository),
    EngagementLoader,
    ...Object.values(handlers),
    FixNullMethodologiesMigration,
    AddMilestoneReachedMigration,
    AddAiAssistFlagMigration,
  ],
  exports: [EngagementService, EngagementRepository],
})
export class EngagementModule {}
