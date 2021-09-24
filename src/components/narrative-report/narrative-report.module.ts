import { Module } from '@nestjs/common';
import { NarrativeReportResolver } from './narrative-report.resolver';

@Module({
  providers: [NarrativeReportResolver],
})
export class NarrativeReportModule {}
