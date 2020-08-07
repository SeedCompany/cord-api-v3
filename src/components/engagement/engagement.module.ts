import { forwardRef, Module } from '@nestjs/common';
import { CeremonyModule } from '../ceremony/ceremony.module';
import { FileModule } from '../file/file.module';
import { LanguageModule } from '../language/language.module';
import { LocationModule } from '../location/location.module';
import { ProductModule } from '../product/product.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { EngagementResolver } from './engagement.resolver';
import { EngagementService } from './engagement.service';
import { InternshipEngagementResolver } from './internship-engagement.resolver';
import { LanguageEngagementResolver } from './language-engagement.resolver';

@Module({
  imports: [
    FileModule,
    UserModule,
    CeremonyModule,
    ProductModule,
    LanguageModule,
    LocationModule,
    forwardRef(() => ProjectModule),
  ],
  providers: [
    EngagementResolver,
    LanguageEngagementResolver,
    InternshipEngagementResolver,
    EngagementService,
  ],
  exports: [EngagementService],
})
export class EngagementModule {}
