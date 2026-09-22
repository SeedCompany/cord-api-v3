import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, MutationPlaceholderOutput } from '~/common';
import {
  CreateGtlReportPracticum,
  GtlGoal,
  GtlGoalProgress,
  GTLReport,
  GtlReportPracticum,
  GtlReportPracticumCreated,
  GtlReportPracticumUpdated,
  UpdateGtlReportPracticum,
} from './dto';
import { GtlGoalService } from './goals/gtl-goal.service';
import { GtlReportPracticumService } from './practicums/gtl-report-practicum.service';

@Resolver(GTLReport)
export class GtlReportSectionsResolver {
  constructor(
    private readonly goalService: GtlGoalService,
    private readonly practicumService: GtlReportPracticumService,
  ) {}

  @ResolveField(() => [GtlGoal], {
    description: 'Goals first proposed in this report',
  })
  async goalsSet(@Parent() report: GTLReport): Promise<GtlGoal[]> {
    return await this.goalService.listSetInReport(report.id);
  }

  @ResolveField(() => [GtlGoalProgress], {
    description: 'What this quarter reported about the leader’s goals',
  })
  async goalProgress(@Parent() report: GTLReport): Promise<GtlGoalProgress[]> {
    return await this.goalService.listProgressForReport(report.id);
  }

  @ResolveField(() => [GtlReportPracticum])
  async practicums(@Parent() report: GTLReport): Promise<GtlReportPracticum[]> {
    return await this.practicumService.listForReport(report.id);
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
