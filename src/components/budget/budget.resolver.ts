import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { IdArg } from '../../common';
import { Budget } from './budget';
import { BudgetService } from './budget.service';
import { ISession, Session } from '../auth/session';
import {
  CreateBudgetInputDto,
  CreateBudgetOutputDto,
  ReadBudgetInputDto,
  ReadBudgetOutputDto,
  UpdateBudgetInputDto,
  UpdateBudgetOutputDto,
  DeleteBudgetInputDto,
  DeleteBudgetOutputDto,
} from './budget.dto';

@Resolver(of => Budget)
export class BudgetResolver {
  constructor(private readonly budgetService: BudgetService) {}

  @Mutation(returns => CreateBudgetOutputDto, {
    description: 'Create a Budget',
  })
  async createBudget(
    @Session() session: ISession,
    @Args('input') { budget: input }: CreateBudgetInputDto,
  ): Promise<CreateBudgetOutputDto> {
    return await this.budgetService.create(input, session);
  }
  @Query(returns => ReadBudgetOutputDto, {
    description: 'Read one Budget by id',
  })
  async readBudget(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<ReadBudgetOutputDto> {
    return await this.budgetService.readOne(id, session);
  }

  @Mutation(returns => UpdateBudgetOutputDto, {
    description: 'Update a Budget',
  })
  async updateBudget(
    @Session() session: ISession,
    @Args('input') { budget: input }: UpdateBudgetInputDto,
  ): Promise<UpdateBudgetOutputDto> {
    return await this.budgetService.update(input, session);
  }

  @Mutation(returns => DeleteBudgetOutputDto, {
    description: 'Delete a Budget',
  })
  async deleteBudget(
    @Session() session: ISession,
    @IdArg() id: string,
  ): Promise<boolean> {
    await this.budgetService.delete(id, session);
    return true;
  }
}
