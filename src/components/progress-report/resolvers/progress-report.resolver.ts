import { Resolver } from '@nestjs/graphql';
import { ProgressReportService } from '../progress-report.service';

@Resolver()
export class ProgressReportResolver {
  constructor(private readonly service: ProgressReportService) {}
}
