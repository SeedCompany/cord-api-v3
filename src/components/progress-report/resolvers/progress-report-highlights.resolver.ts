import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '~/common';
import { PromptVariantResponseList } from '../../prompts/dto';
import { ProgressReport } from '../dto';
import { ProgressReportHighlightsService } from '../progress-report-highlights.service';

@Resolver(ProgressReport)
export class ProgressReportHighlightsResolver {
  constructor(private readonly service: ProgressReportHighlightsService) {}

  @ResolveField(() => PromptVariantResponseList)
  async highlights(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<PromptVariantResponseList> {
    const [list, available] = await Promise.all([
      this.service.list(report, session),
      this.service.getAvailable(session),
    ]);
    return { ...list, available };
  }
}
