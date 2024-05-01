import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { ProjectType } from '../dto';
import {
  ProjectTypeFinancialApprover,
  ProjectTypeFinancialApproverInput,
} from './financial-approver.dto';
import { FinancialApproverService } from './financial-approver.service';

@Resolver(ProjectTypeFinancialApprover)
export class FinancialApproverResolver {
  constructor(private readonly service: FinancialApproverService) {}

  // @ResolveField(() => ProjectTypeFinancialApprover, { nullable: true })
  @Query(() => [ProjectTypeFinancialApprover])
  async list(
    @Args({
      name: 'projectType',
      type: () => ProjectType,
    })
    projectType: ProjectType,
    @LoggedInSession() session: Session,
  ) {
    return await this.service.list(projectType, session);
  }

  @Mutation(() => ProjectTypeFinancialApprover)
  async updateFinancialApprover(
    @Args({
      name: 'input',
      type: () => ProjectTypeFinancialApproverInput,
    })
    input: ProjectTypeFinancialApproverInput,
    @LoggedInSession() session: Session,
  ) {
    return await this.service.update(input, session);
  }
}
