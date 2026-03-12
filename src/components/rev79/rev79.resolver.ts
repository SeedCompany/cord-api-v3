import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Rev79BulkUploadProgressReportsInput,
  Rev79BulkUploadResult,
  Rev79QuarterlyReportContextInput,
  Rev79QuarterlyReportContextResult,
} from './dto';
import { Rev79Service } from './rev79.service';

@Resolver()
export class Rev79Resolver {
  constructor(private readonly service: Rev79Service) {}

  @Query(() => Rev79QuarterlyReportContextResult, {
    description: `
      Resolve a quarterly progress report context by Rev79 identifiers.

      Given a Rev79 project ID, Rev79 community ID, and a calendar quarter,
      returns the corresponding Cord project, language engagement, and progress
      report IDs along with the report's date range.

      Errors are domain-typed so callers can distinguish between a missing
      project, a missing/ambiguous community mapping, an out-of-range quarter,
      or a missing progress report.
    `,
  })
  async rev79QuarterlyReportContext(
    @Args('input') input: Rev79QuarterlyReportContextInput,
  ): Promise<Rev79QuarterlyReportContextResult> {
    return await this.service.resolveQuarterlyReportContext(input);
  }

  @Mutation(() => Rev79BulkUploadResult, {
    description: `
      Bulk upload progress report data for multiple communities under a single Rev79 project.

      Resolves each report by rev79CommunityId and fiscal quarter, then applies
      team news, community story, and product progress data in a single call.
      All report items must belong to the same Rev79 project.

      Media uploads are not included — use uploadProgressReportMedia separately.
    `,
  })
  async uploadRev79ProgressReports(
    @Args('input') input: Rev79BulkUploadProgressReportsInput,
  ): Promise<Rev79BulkUploadResult> {
    return await this.service.uploadProgressReports(input);
  }
}
