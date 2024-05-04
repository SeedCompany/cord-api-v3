import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { ProjectType } from '../dto/project-type.enum';
import { ProjectTypeFinancialApprover } from './dto/project-type-financial-approver.dto';
import {
  SetProjectTypeFinancialApproverInput,
  SetProjectTypeFinancialApproverOutput,
} from './dto/set-project-type-financial-approver.dto';
import { ProjectTypeFinancialApproverService } from './project-type-financial-approver.service';

@Resolver(ProjectTypeFinancialApprover)
export class ProjectTypeFinancialApproverResolver {
  constructor(private readonly service: ProjectTypeFinancialApproverService) {}

  @Mutation(() => SetProjectTypeFinancialApproverOutput, {
    description: 'Set a financial approver for a project type',
  })
  async setProjectTypeFinancialApprover(
    @LoggedInSession() session: Session,
    @Args('input')
    { financialApprover: input }: SetProjectTypeFinancialApproverInput,
  ) {
    const financialApprover = await this.service.setFinancialApprover(
      input,
      session,
    );
    return financialApprover;
  }

  @Query(() => [ProjectTypeFinancialApprover])
  async list(
    @Args({
      name: 'projectType',
      type: () => [ProjectType],
    })
    projectType: ProjectType[],
    @LoggedInSession() session: Session,
  ) {
    return await this.service.list(projectType, session);
  }
}
