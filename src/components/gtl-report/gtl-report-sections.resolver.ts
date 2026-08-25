import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, MutationPlaceholderOutput } from '~/common';
import {
  CreateGtlReportGoal,
  CreateGtlReportPracticum,
  GTLReport,
  GtlReportGoal,
  GtlReportGoalCreated,
  GtlReportGoalUpdated,
  GtlReportPracticum,
  GtlReportPracticumCreated,
  GtlReportPracticumUpdated,
  ReviewGtlReportGoal,
  UpdateGtlReportGoal,
  UpdateGtlReportPracticum,
} from './dto';
import { GtlReportGoalService } from './goals/gtl-report-goal.service';
import { GtlReportPracticumService } from './practicums/gtl-report-practicum.service';

@Resolver(GTLReport)
export class GtlReportSectionsResolver {
  constructor(
    private readonly goalService: GtlReportGoalService,
    private readonly practicumService: GtlReportPracticumService,
  ) {}

  @ResolveField(() => [GtlReportGoal], {
    description: 'The goals set in this report, for the coming quarter',
  })
  async goals(@Parent() report: GTLReport): Promise<GtlReportGoal[]> {
    return await this.goalService.listSetIn(report.id);
  }

  @ResolveField(() => [GtlReportGoal], {
    description:
      "The previous quarter's goals, which this report is reviewing. Read from the goals themselves rather than retyped — see GtlReportGoal.",
  })
  async previousQuarterGoals(
    @Parent() report: GTLReport,
  ): Promise<GtlReportGoal[]> {
    return await this.goalService.listReviewedIn(report.id);
  }

  @ResolveField(() => [GtlReportPracticum])
  async practicums(@Parent() report: GTLReport): Promise<GtlReportPracticum[]> {
    return await this.practicumService.listForReport(report.id);
  }

  @Mutation(() => GtlReportGoalCreated)
  async createGtlReportGoal(
    @Args('input') input: CreateGtlReportGoal,
  ): Promise<GtlReportGoalCreated> {
    return { gtlReportGoal: await this.goalService.create(input) };
  }

  @Mutation(() => GtlReportGoalUpdated)
  async updateGtlReportGoal(
    @Args('input') input: UpdateGtlReportGoal,
  ): Promise<GtlReportGoalUpdated> {
    return { gtlReportGoal: await this.goalService.update(input) };
  }

  @Mutation(() => GtlReportGoalUpdated, {
    description:
      "Record whether a previous quarter's goal was met, and its impact.",
  })
  async reviewGtlReportGoal(
    @Args('input') input: ReviewGtlReportGoal,
  ): Promise<GtlReportGoalUpdated> {
    return { gtlReportGoal: await this.goalService.review(input) };
  }

  @Mutation(() => MutationPlaceholderOutput)
  async deleteGtlReportGoal(
    @IdArg() id: ID,
  ): Promise<MutationPlaceholderOutput> {
    await this.goalService.delete(id);
    return {};
  }

  @Mutation(() => GtlReportPracticumCreated)
  async createGtlReportPracticum(
    @Args('input') input: CreateGtlReportPracticum,
  ): Promise<GtlReportPracticumCreated> {
    return { gtlReportPracticum: await this.practicumService.create(input) };
  }

  @Mutation(() => GtlReportPracticumUpdated)
  async updateGtlReportPracticum(
    @Args('input') input: UpdateGtlReportPracticum,
  ): Promise<GtlReportPracticumUpdated> {
    return { gtlReportPracticum: await this.practicumService.update(input) };
  }

  @Mutation(() => MutationPlaceholderOutput)
  async deleteGtlReportPracticum(
    @IdArg() id: ID,
  ): Promise<MutationPlaceholderOutput> {
    await this.practicumService.delete(id);
    return {};
  }
}
