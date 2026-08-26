import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, MutationPlaceholderOutput } from '~/common';
import { type Engagement, InternshipEngagement } from '../engagement/dto';
import {
  CreateGtlGoal,
  GtlGoal,
  GtlGoalCreated,
  GtlGoalProgress,
  GtlGoalProgressReported,
  GtlGoalSummary,
  GtlGoalUpdated,
  ReportGtlGoalProgress,
  UpdateGtlGoal,
} from './dto';
import { GtlGoalService } from './goals/gtl-goal.service';

/**
 * The growth plan, on the engagement it belongs to.
 *
 * Goals are engagement-scoped rather than report-scoped, so this is where they
 * are created and listed; a report reports progress against them.
 */
@Resolver(InternshipEngagement)
export class GtlGoalEngagementResolver {
  constructor(private readonly goals: GtlGoalService) {}

  @ResolveField(() => GtlGoalSummary, {
    description: 'Every goal on this leader’s growth plan, and how it tracks',
  })
  async goalSummary(@Parent() engagement: Engagement): Promise<GtlGoalSummary> {
    return await this.goals.summaryForEngagement(engagement.id);
  }
}

@Resolver(GtlGoalProgress)
export class GtlGoalProgressResolver {
  constructor(private readonly goals: GtlGoalService) {}

  @ResolveField(() => GtlGoal, {
    description: 'The goal this entry reports on',
  })
  async goal(@Parent() progress: GtlGoalProgress): Promise<GtlGoal> {
    return await this.goals.readOne(progress.goal.id);
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
