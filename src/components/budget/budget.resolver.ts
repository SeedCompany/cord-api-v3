import {
  Args,
  Float,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { sumBy } from 'lodash';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { BudgetLoader, BudgetService } from '../budget';
import { IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { FileNodeLoader, resolveDefinedFile, SecuredFile } from '../file';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  CreateBudgetInput,
  CreateBudgetOutput,
  DeleteBudgetOutput,
  UpdateBudgetInput,
  UpdateBudgetOutput,
} from './dto';

@Resolver(Budget)
export class BudgetResolver {
  constructor(private readonly service: BudgetService) {}

  @Query(() => Budget, {
    description: 'Look up a budget by its ID',
  })
  async budget(
    @Loader(BudgetLoader) budgets: LoaderOf<BudgetLoader>,
    @IdsAndViewArg() key: IdsAndView
  ): Promise<Budget> {
    return await budgets.load(key);
  }

  @Query(() => BudgetListOutput, {
    description: 'Look up budgets by projectId',
  })
  async budgets(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => BudgetListInput,
      defaultValue: BudgetListInput.defaultVal,
    })
    input: BudgetListInput,
    @Loader(BudgetLoader) budgets: LoaderOf<BudgetLoader>
  ): Promise<BudgetListOutput> {
    const list = await this.service.list(input, session);
    budgets.primeAll(list.items);
    return list;
  }

  @ResolveField(() => Float)
  async total(@Parent() budget: Budget): Promise<number> {
    return sumBy(budget.records, (record) => record.amount.value ?? 0);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The universal budget template',
  })
  async universalTemplateFile(
    @Parent() budget: Budget,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, budget.universalTemplateFile);
  }

  @Mutation(() => CreateBudgetOutput, {
    description: 'Create a budget',
  })
  async createBudget(
    @LoggedInSession() session: Session,
    @Args('input') { budget: input }: CreateBudgetInput
  ): Promise<CreateBudgetOutput> {
    const budget = await this.service.create(input, session);
    return { budget };
  }

  @Mutation(() => UpdateBudgetOutput, {
    description: 'Update a budget',
  })
  async updateBudget(
    @LoggedInSession() session: Session,
    @Args('input') { budget: input }: UpdateBudgetInput
  ): Promise<UpdateBudgetOutput> {
    const budget = await this.service.update(input, session);
    return { budget };
  }

  @Mutation(() => DeleteBudgetOutput, {
    description: 'Delete a budget',
  })
  async deleteBudget(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteBudgetOutput> {
    await this.service.delete(id, session);
    return { success: true };
  }
}
