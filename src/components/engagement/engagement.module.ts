import { Module } from '@nestjs/common';
import { EngagementResolver } from './engagement.resolver';
import { EngagementService } from './engagement.service';
import { InternshipEngagementResolver } from './internship-engagement.resolver';
import { LanguageEngagementResolver } from './language-engagement.resolver';

@Module({
  providers: [
    EngagementResolver,
    LanguageEngagementResolver,
    InternshipEngagementResolver,
    EngagementService,
  ],
  exports: [EngagementService],
})
export class EngagementModule {}
