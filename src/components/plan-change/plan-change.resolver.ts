import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import {
  CreatePlanChangeInput,
  CreatePlanChangeOutput,
  PlanChange,
  UpdatePlanChangeInput,
  UpdatePlanChangeOutput,
} from './dto';
import { ChangeListInput, ChangeListOutput } from './dto/change-list.dto';
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
    @IdArg() id: ID
  ): Promise<PlanChange> {
    return await this.service.readOne(id, session);
  }

  @Query(() => ChangeListOutput, {
    description: 'Look up planChanges',
  })
  async planChanges(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => ChangeListInput,
      defaultValue: ChangeListInput.defaultVal,
    })
    input: ChangeListInput
  ): Promise<ChangeListOutput> {
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
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
