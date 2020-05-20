import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { BudgetService } from './budget.service';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  UpdateBudgetInput,
  UpdateBudgetOutput,
} from './dto';

@Resolver(Budget.classType)
export class BudgetResolver {
  constructor(private readonly service: BudgetService) {}

  @Query(() => Budget, {
    description: 'Look up a budget by its ID',
  })
  async budget(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Budget> {
    return this.service.readOne(id, session);
  }

  @Query(() => BudgetListOutput, {
    description: 'Look up budgets by projectId',
  })
  async budgets(
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

  @Query(() => Boolean, {
    description: 'Check Consistency in Budget Nodes',
  })
  async checkBudgetConsistency(@Session() session: ISession): Promise<boolean> {
    return this.service.checkBudgetConsistency(session);
  }
}
