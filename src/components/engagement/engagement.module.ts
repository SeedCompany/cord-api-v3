import { Module } from '@nestjs/common';
import { CeremonyModule } from '../ceremony';
import { LanguageModule } from '../language';
import { LocationModule } from '../location';
import { ProductModule } from '../product';
import { UserModule } from '../user';
import { EngagementResolver } from './engagement.resolver';
import { EngagementService } from './engagement.service';
import { InternshipEngagementResolver } from './internship-engagement.resolver';
import { LanguageEngagementResolver } from './language-engagement.resolver';

@Module({
  imports: [
    UserModule,
    CeremonyModule,
    ProductModule,
    LanguageModule,
    LocationModule,
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
