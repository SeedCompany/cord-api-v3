import {
  Args,
  Float,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { sumBy } from 'lodash';
import { Loader, type LoaderOf } from '~/core';
import { BudgetService } from '../budget';
import { FileNodeLoader, resolveDefinedFile } from '../file';
import { SecuredFile } from '../file/dto';
import { Budget, BudgetUpdated, UpdateBudget } from './dto';

@Resolver(Budget)
export class BudgetResolver {
  constructor(private readonly service: BudgetService) {}

  @ResolveField(() => Float)
  async total(@Parent() budget: Budget): Promise<number> {
    return sumBy(budget.records, (record) => record.amount.value ?? 0);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The universal budget template',
  })
  async universalTemplateFile(
    @Parent() budget: Budget,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, budget.universalTemplateFile);
  }

  @Mutation(() => BudgetUpdated, {
    description: 'Update a budget',
  })
  async updateBudget(
    @Args('input') input: UpdateBudget,
  ): Promise<BudgetUpdated> {
    const budget = await this.service.update(input);
    return { budget };
  }
}
