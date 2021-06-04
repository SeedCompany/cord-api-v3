import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, NotImplementedException, Session } from '../../common';
import { ProgressReport } from '../periodic-report';
import { ProgressSummary } from './dto';

@Resolver(ProgressReport)
export class ProgressReportConnectionResolver {
  @ResolveField(() => ProgressSummary, {
    nullable: true,
  })
  async summary(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<ProgressSummary | null> {
    throw new NotImplementedException().with(report, session);
  }
}
