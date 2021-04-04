import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, IdArg, LoggedInSession, Session } from '../../../common';
import {
  CreatePlanChangeInput,
  CreatePlanChangeOutput,
  PlanChange,
  PlanChangeListInput,
  PlanChangeListOutput,
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

  @Query(() => PlanChange, {
    description: 'Look up a planChange by ID',
  })
  async planChange(
    @AnonSession() session: Session,
    @IdArg() id: string
  ): Promise<PlanChange> {
    return await this.service.readOne(id, session);
  }

  @Query(() => PlanChangeListOutput, {
    description: 'Look up planChanges',
  })
  async planChanges(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => PlanChangeListInput,
      defaultValue: PlanChangeListInput.defaultVal,
    })
    input: PlanChangeListInput
  ): Promise<PlanChangeListOutput> {
    return this.service.list(input, session);
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
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
