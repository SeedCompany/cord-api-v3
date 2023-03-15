import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyModule } from '../ceremony/ceremony.module';
import { FileModule } from '../file/file.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { ProductModule } from '../product/product.module';
import { ProjectModule } from '../project/project.module';
import { EngagementStatusResolver } from './engagement-status.resolver';
import { EngagementLoader } from './engagement.loader';
import { EngagementRepository } from './engagement.repository';
import { EngagementResolver } from './engagement.resolver';
import { EngagementRules } from './engagement.rules';
import { EngagementService } from './engagement.service';
import * as handlers from './handlers';
import { InternshipEngagementResolver } from './internship-engagement.resolver';
import { InternshipPositionResolver } from './internship-position.resolver';
import { LanguageEngagementResolver } from './language-engagement.resolver';
import { OutcomesResolver } from './outcomes/outcomes.resolver';
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
    EngagementRepository,
    EngagementLoader,
    OutcomesResolver,
    ...Object.values(handlers),
  ],
  exports: [EngagementService, EngagementRepository],
})
export class EngagementModule {}
