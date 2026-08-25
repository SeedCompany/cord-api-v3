import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { type Engagement, InternshipEngagement } from '../engagement/dto';
import { GtlGrowthPlan } from './dto';
import { GtlReportGoalService } from './goals/gtl-report-goal.service';

/**
 * The growth plan at a glance, on the engagement itself.
 *
 * Goals live on reports — one quarter sets them, the next reviews them — so
 * seeing the plan as a whole means reading across every report. That rollup
 * belongs here rather than in the client, which would otherwise have to page
 * every report to count three numbers.
 */
@Resolver(InternshipEngagement)
export class GtlGrowthPlanResolver {
  constructor(private readonly goals: GtlReportGoalService) {}

  @ResolveField(() => GtlGrowthPlan)
  async growthPlan(@Parent() engagement: Engagement): Promise<GtlGrowthPlan> {
    const goals = await this.goals.listForEngagement(engagement.id);
    const reviewed = goals.filter((g) => g.met.value != null);
    return {
      goals,
      total: goals.length,
      met: reviewed.filter((g) => g.met.value).length,
      unmet: reviewed.filter((g) => !g.met.value).length,
      awaitingReview: goals.length - reviewed.length,
    };
  }
}
