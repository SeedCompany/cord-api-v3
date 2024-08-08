import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyModule } from '../ceremony/ceremony.module';
import { FileModule } from '../file/file.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { ProductModule } from '../product/product.module';
import { ProjectModule } from '../project/project.module';
import { EngagementLoader } from './engagement.loader';
import { EngagementRepository } from './engagement.repository';
import { EngagementResolver } from './engagement.resolver';
import { EngagementService } from './engagement.service';
import * as handlers from './handlers';
import { InternshipEngagementResolver } from './internship-engagement.resolver';
import { InternshipPositionResolver } from './internship-position.resolver';
import { LanguageEngagementResolver } from './language-engagement.resolver';
import { FixNullMethodologiesMigration } from './migrations/fix-null-methodologies.migration';
import { EngagementProductConnectionResolver } from './product-connection.resolver';
import { EngagementWorkflowModule } from './workflow/engagement-workflow.module';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => FileModule),
    CeremonyModule,
    ProductModule,
    forwardRef(() => LanguageModule),
    forwardRef(() => LocationModule),
    forwardRef(() => ProjectModule),
    EngagementWorkflowModule,
  ],
  providers: [
    EngagementResolver,
    LanguageEngagementResolver,
    InternshipEngagementResolver,
    InternshipPositionResolver,
    EngagementProductConnectionResolver,
    EngagementService,
    EngagementRepository,
    EngagementLoader,
    ...Object.values(handlers),
    FixNullMethodologiesMigration,
  ],
  exports: [EngagementService, EngagementRepository],
})
export class EngagementModule {}
