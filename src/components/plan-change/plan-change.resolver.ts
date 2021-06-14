import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '../../common';
import {
  CreatePlanChangeInput,
  CreatePlanChangeOutput,
  UpdatePlanChangeInput,
  UpdatePlanChangeOutput,
} from './dto';
import { PlanChangeService } from './plan-change.service';

@Resolver()
export class PlanChangeResolver {
  constructor(private readonly service: PlanChangeService) {}

  @Mutation(() => CreatePlanChangeOutput, {
    description: 'Create a plan change',
  })
  async createPlanChange(
    @Args('input') { planChange: input }: CreatePlanChangeInput,
    @LoggedInSession() session: Session
  ): Promise<CreatePlanChangeOutput> {
    const planChange = await this.service.create(input, session);
    return { planChange };
  }

  @Mutation(() => UpdatePlanChangeOutput, {
    description: 'Update a plan change',
  })
  async updatePlanChange(
    @LoggedInSession() session: Session,
    @Args('input') { planChange: input }: UpdatePlanChangeInput
  ): Promise<UpdatePlanChangeOutput> {
    const planChange = await this.service.update(input, session);
    return { planChange };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a plan change',
  })
  async deletePlanChange(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
