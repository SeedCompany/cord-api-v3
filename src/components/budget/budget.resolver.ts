import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { BudgetService } from './budget.service';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  BudgetRecord,
  BudgetRecordListInput,
  BudgetRecordListOutput,
  CreateBudgetInput,
  CreateBudgetOutput,
  CreateBudgetRecordInput,
  CreateBudgetRecordOutput,
  UpdateBudgetInput,
  UpdateBudgetOutput,
  UpdateBudgetRecordInput,
  UpdateBudgetRecordOutput,
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

  @Mutation(() => CreateBudgetRecordOutput, {
    description: 'Create an budget Record entry',
  })
  async createBudgetRecord(
    @Session() session: ISession,
    @Args('input') { budgetRecord: input }: CreateBudgetRecordInput
  ): Promise<CreateBudgetRecordOutput> {
    const budgetRecord = await this.service.createRecord(input, session);
    return { budgetRecord };
  }

  @Query(() => BudgetRecord, {
    description: 'Look up a budget Record by its ID',
  })
  async budgetRecord(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<BudgetRecord> {
    return await this.service.readOneRecord(id, session);
  }

  @Query(() => BudgetRecordListOutput, {
    description: 'Look up budget Records by budgetId',
  })
  async budgetRecords(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => BudgetRecordListInput,
      defaultValue: BudgetRecordListInput.defaultVal,
    })
    input: BudgetRecordListInput
  ): Promise<BudgetRecordListOutput> {
    return this.service.listRecords(input, session);
  }

  @Mutation(() => UpdateBudgetRecordOutput, {
    description: 'Update a budgetRecord',
  })
  async updateBudgetRecord(
    @Session() session: ISession,
    @Args('input') { budgetRecord: input }: UpdateBudgetRecordInput
  ): Promise<UpdateBudgetRecordOutput> {
    const budgetRecord = await this.service.updateRecord(input, session);
    return { budgetRecord };
  }

  @Mutation(() => Boolean, {
    description: 'Delete an budget',
  })
  async deleteBudgetRecord(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.deleteRecord(id, session);
    return true;
  }
}
