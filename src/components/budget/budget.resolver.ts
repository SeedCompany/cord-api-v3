import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Budget } from './budget';
import { BudgetService } from './budget.service';
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
    @Args('input') { budget: input }: CreateBudgetInputDto,
  ): Promise<CreateBudgetOutputDto> {
    return await this.budgetService.create(input);
  }
  @Query(returns => ReadBudgetOutputDto, {
    description: 'Read one Budget by id',
  })
  async readBudget(
    @Args('input') { budget: input }: ReadBudgetInputDto,
  ): Promise<ReadBudgetOutputDto> {
    return await this.budgetService.readOne(input);
  }

  @Mutation(returns => UpdateBudgetOutputDto, {
    description: 'Update an Budget',
  })
  async updateBudget(
    @Args('input')
    { budget: input }: UpdateBudgetInputDto,
  ): Promise<UpdateBudgetOutputDto> {
    return await this.budgetService.update(input);
  }

  @Mutation(returns => DeleteBudgetOutputDto, {
    description: 'Delete an Budget',
  })
  async deleteBudget(
    @Args('input')
    { budget: input }: DeleteBudgetInputDto,
  ): Promise<DeleteBudgetOutputDto> {
    return await this.budgetService.delete(input);
  }
}
