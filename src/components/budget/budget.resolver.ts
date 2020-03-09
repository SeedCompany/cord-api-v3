import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  CreateBudgetInputDto,
  CreateBudgetOutputDto,
  DeleteBudgetInputDto,
  DeleteBudgetOutputDto,
  ReadBudgetInputDto,
  ReadBudgetOutputDto,
  UpdateBudgetInputDto,
  UpdateBudgetOutputDto,
} from './budget.dto';
import { BudgetService } from './budget.service';

@Resolver()
export class BudgetResolver {
  constructor(private readonly budgetService: BudgetService) {}

  @Mutation(() => CreateBudgetOutputDto, {
    description: 'Create a Budget',
  })
  async createBudget(
    @Args('input') { budget: input }: CreateBudgetInputDto
  ): Promise<CreateBudgetOutputDto> {
    return await this.budgetService.create(input);
  }
  @Query(() => ReadBudgetOutputDto, {
    description: 'Read one Budget by id',
  })
  async readBudget(
    @Args('input') { budget: input }: ReadBudgetInputDto
  ): Promise<ReadBudgetOutputDto> {
    return await this.budgetService.readOne(input);
  }

  @Mutation(() => UpdateBudgetOutputDto, {
    description: 'Update an Budget',
  })
  async updateBudget(
    @Args('input')
    { budget: input }: UpdateBudgetInputDto
  ): Promise<UpdateBudgetOutputDto> {
    return await this.budgetService.update(input);
  }

  @Mutation(() => DeleteBudgetOutputDto, {
    description: 'Delete an Budget',
  })
  async deleteBudget(
    @Args('input')
    { budget: input }: DeleteBudgetInputDto
  ): Promise<DeleteBudgetOutputDto> {
    return await this.budgetService.delete(input);
  }
}
