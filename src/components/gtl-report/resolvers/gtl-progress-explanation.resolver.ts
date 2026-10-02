import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ExplainGtlProgress, GtlProgressExplanation, GTLReport } from '../dto';
import { GtlProgressExplanationService } from '../progress-explanation/gtl-progress-explanation.service';

/** The Explanation of Progress section of a GTL report. */
@Resolver(GTLReport)
export class GtlProgressExplanationResolver {
  constructor(private readonly explanations: GtlProgressExplanationService) {}

  @ResolveField(() => GtlProgressExplanation, {
    nullable: true,
    description:
      "The Field Project Manager's explanation of progress. Confidential — Field Operations only; null for everyone else.",
  })
  async progressExplanation(
    @Parent() report: GTLReport,
  ): Promise<GtlProgressExplanation | null> {
    return await this.explanations.readOne(report);
  }

  @Mutation(() => GTLReport, {
    description:
      'Give or revise the explanation of how the internship is tracking. Upserts the report’s one explanation.',
  })
  async explainGtlProgress(
    @Args('input') input: ExplainGtlProgress,
  ): Promise<GTLReport> {
    return await this.explanations.explain(input);
  }
}
