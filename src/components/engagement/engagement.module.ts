import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyModule } from '../ceremony/ceremony.module';
import { FileModule } from '../file/file.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { ProductModule } from '../product/product.module';
import { ProjectRules } from '../project';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { EngagementStatusResolver } from './engagement-status.resolver';
import { EngagementResolver } from './engagement.resolver';
import { EngagementRules } from './engagement.rules';
import { EngagementService } from './engagement.service';
import * as handlers from './handlers';
import { InternshipEngagementResolver } from './internship-engagement.resolver';
import { InternshipPositionResolver } from './internship-position.resolver';
import { LanguageEngagementResolver } from './language-engagement.resolver';
import { PnpExtractor } from './pnp-extractor.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    FileModule,
    forwardRef(() => UserModule),
    CeremonyModule,
    ProductModule,
    forwardRef(() => LanguageModule),
    LocationModule,
    forwardRef(() => ProjectModule),
    forwardRef(() => ProjectRules),
  ],
  providers: [
    EngagementResolver,
    LanguageEngagementResolver,
    InternshipEngagementResolver,
    EngagementStatusResolver,
    InternshipPositionResolver,
    EngagementRules,
    EngagementService,
    PnpExtractor,
    ...Object.values(handlers),
  ],
  exports: [EngagementService],
})
export class EngagementModule {}
