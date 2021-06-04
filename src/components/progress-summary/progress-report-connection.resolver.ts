import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { ProgressReport } from '../periodic-report';
import { ProgressSummary } from './dto';
import { ProgressSummaryRepository } from './progress-summary.repository';

@Resolver(ProgressReport)
export class ProgressReportConnectionResolver {
  constructor(private readonly repo: ProgressSummaryRepository) {}

  @ResolveField(() => ProgressSummary, {
    nullable: true,
  })
  async summary(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<ProgressSummary | undefined> {
    return await this.repo.readOne(report.id, session);
  }
}
