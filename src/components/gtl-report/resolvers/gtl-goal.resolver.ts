import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, MutationPlaceholderOutput } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { InternshipEngagement } from '../../engagement/dto';
import {
  CreateGtlGoal,
  GtlGoal,
  GtlGoalCreated,
  GtlGoalProgress,
  GtlGoalProgressReported,
  GtlGoalSummary,
  GtlGoalUpdated,
  GTLReport,
  ReportGtlGoalProgress,
  UpdateGtlGoal,
} from '../dto';
import { GtlGoalLoader } from '../goals/gtl-goal.loader';
import { GtlGoalService } from '../goals/gtl-goal.service';

/**
 * The growth plan, on the engagement it belongs to.
 *
 * Goals are engagement-scoped rather than report-scoped, so this is where they
 * are listed; a report reports progress against them.
 */
@Resolver(InternshipEngagement)
export class GtlGoalEngagementResolver {
  constructor(private readonly goals: GtlGoalService) {}

  @ResolveField(() => GtlGoalSummary, {
    description: 'Every goal on this leader’s growth plan, and how it tracks',
  })
  async goalSummary(
    @Parent() engagement: InternshipEngagement,
  ): Promise<GtlGoalSummary> {
    return await this.goals.summaryForEngagement(engagement.id);
  }
}

/** What one quarter's report has to do with the goals. */
@Resolver(GTLReport)
export class GtlReportGoalsResolver {
  constructor(private readonly goals: GtlGoalService) {}

  @ResolveField(() => [GtlGoal], {
    description: 'Goals first proposed in this report',
  })
  async goalsSet(@Parent() report: GTLReport): Promise<GtlGoal[]> {
    return await this.goals.listSetInReport(report.id);
  }

  @ResolveField(() => [GtlGoalProgress], {
    description: 'What this quarter reported about the leader’s goals',
  })
  async goalProgress(@Parent() report: GTLReport): Promise<GtlGoalProgress[]> {
    return await this.goals.listProgressForReport(report.id);
  }
}

@Resolver(GtlGoalProgress)
export class GtlGoalProgressResolver {
  @ResolveField(() => GtlGoal, {
    description: 'The goal this entry reports on',
  })
  async goal(
    @Parent() progress: GtlGoalProgress,
    @Loader(GtlGoalLoader) goals: LoaderOf<GtlGoalLoader>,
  ): Promise<GtlGoal> {
    return await goals.load(progress.goal.id);
  }
}

@Resolver(GtlGoal)
export class GtlGoalResolver {
  constructor(private readonly goals: GtlGoalService) {}

  @Mutation(() => GtlGoalCreated)
  async createGtlGoal(
    @Args('input') input: CreateGtlGoal,
  ): Promise<GtlGoalCreated> {
    return { gtlGoal: await this.goals.create(input) };
  }

  @Mutation(() => GtlGoalUpdated)
  async updateGtlGoal(
    @Args('input') input: UpdateGtlGoal,
  ): Promise<GtlGoalUpdated> {
    return { gtlGoal: await this.goals.update(input) };
  }

  @Mutation(() => MutationPlaceholderOutput)
  async deleteGtlGoal(@IdArg() id: ID): Promise<MutationPlaceholderOutput> {
    await this.goals.delete(id);
    return {};
  }

  @Mutation(() => GtlGoalProgressReported, {
    description:
      'Record what happened with a goal during one quarter. Upserts that quarter’s entry.',
  })
  async reportGtlGoalProgress(
    @Args('input') input: ReportGtlGoalProgress,
  ): Promise<GtlGoalProgressReported> {
    return await this.goals.reportProgress(input);
  }
}
