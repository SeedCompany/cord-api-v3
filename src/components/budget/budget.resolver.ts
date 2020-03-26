import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { BudgetService } from './budget.service';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  CreateBudgetInput,
  CreateBudgetOutput,
  CreateBudgetRecordInput,
  CreateBudgetRecordOutput,
  UpdateBudgetInput,
  UpdateBudgetOutput,
} from './dto';

@Resolver()
export class BudgetResolver {
  constructor(private readonly service: BudgetService) {}

  @Mutation(() => CreateBudgetOutput, {
    description: 'Create an budget entry',
  })
  async createBudget(
    @Session() session: ISession,
    @Args('input') { budget: input }: CreateBudgetInput
  ): Promise<CreateBudgetOutput> {
    const budget = await this.service.create(input, session);
    return { budget };
  }

  @Query(() => Budget, {
    description: 'Look up a budget by its ID',
  })
  async budget(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Budget> {
    return await this.service.readOne(id, session);
  }

  @Query(() => BudgetListOutput, {
    description: 'Look up budgets by projectId',
  })
  async ceremonies(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => BudgetListInput,
      defaultValue: BudgetListInput.defaultVal,
    })
    input: BudgetListInput
  ): Promise<BudgetListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdateBudgetOutput, {
    description: 'Update a budget',
  })
  async updateBudget(
    @Session() session: ISession,
    @Args('input') { budget: input }: UpdateBudgetInput
  ): Promise<UpdateBudgetOutput> {
    const budget = await this.service.update(input, session);
    return { budget };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an budget',
  })
  async deleteBudget(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
export class BudgetRecordResolver {
  constructor(private readonly service: BudgetService) {}

  @Mutation(() => CreateBudgetRecordOutput, {
    description: 'Create an budget Record entry',
  })
  async createBudgetRecord(
    @Session() session: ISession,
    @Args('input') { record: input }: CreateBudgetRecordInput
  ): Promise<CreateBudgetRecordOutput> {
    const record = await this.service.createRecord(input, session);
    return { record };
  }

  @Query(() => Budget, {
    description: 'Look up a budget by its ID',
  })
  async budget(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Budget> {
    return await this.service.readOne(id, session);
  }

  @Query(() => BudgetListOutput, {
    description: 'Look up budgets by projectId',
  })
  async ceremonies(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => BudgetListInput,
      defaultValue: BudgetListInput.defaultVal,
    })
    input: BudgetListInput
  ): Promise<BudgetListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdateBudgetOutput, {
    description: 'Update a budget',
  })
  async updateBudget(
    @Session() session: ISession,
    @Args('input') { budget: input }: UpdateBudgetInput
  ): Promise<UpdateBudgetOutput> {
    const budget = await this.service.update(input, session);
    return { budget };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an budget',
  })
  async deleteBudget(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
