import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../../common';
import { CreatePlanChangeInput, CreatePlanChangeOutput } from './dto';
import { PlanChangeService } from './plan-change.service';

@Resolver()
export class PlanChangeResolver {
  constructor(private readonly changePlanService: PlanChangeService) {}

  @Mutation(() => CreatePlanChangeOutput, {
    description: 'Create a plan change',
  })
  async createPlanChange(
    @Args('input') { planChange: input }: CreatePlanChangeInput,
    @LoggedInSession() session: Session
  ): Promise<CreatePlanChangeOutput> {
    const planChange = await this.changePlanService.create(input, session);
    return { planChange };
  }
}
