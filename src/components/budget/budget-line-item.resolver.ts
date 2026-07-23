import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { OrganizationLoader } from '../organization';
import { BudgetLineItemService } from './budget-line-item.service';
import {
  BudgetLineItem,
  BudgetLineItemCreated,
  BudgetLineItemDeleted,
  BudgetLineItemUpdated,
  CreateBudgetLineItem,
  SecuredOrganizationNullable,
  UpdateBudgetLineItem,
} from './dto';

@Resolver(BudgetLineItem)
export class BudgetLineItemResolver {
  constructor(private readonly service: BudgetLineItemService) {}

  @ResolveField(() => SecuredOrganizationNullable, {
    description:
      'The organization actually providing this service, if different from the funder.',
  })
  async serviceProvider(
    @Parent() lineItem: BudgetLineItem,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganizationNullable> {
    return await mapSecuredValue(lineItem.serviceProvider, (id) =>
      organizations.load(id),
    );
  }

  @ResolveField(() => SecuredOrganizationNullable, {
    description:
      "The organization funding this line, if different from the budget's primary funder.",
  })
  async funder(
    @Parent() lineItem: BudgetLineItem,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganizationNullable> {
    return await mapSecuredValue(lineItem.funder, (id) =>
      organizations.load(id),
    );
  }

  @Mutation(() => BudgetLineItemCreated, {
    description: 'Create a budget line item',
  })
  async createBudgetLineItem(
    @Args('input') input: CreateBudgetLineItem,
  ): Promise<BudgetLineItemCreated> {
    const budgetLineItem = await this.service.create(input);
    return { budgetLineItem };
  }

  @Mutation(() => BudgetLineItemUpdated, {
    description: 'Update a budget line item',
  })
  async updateBudgetLineItem(
    @Args('input') input: UpdateBudgetLineItem,
  ): Promise<BudgetLineItemUpdated> {
    const budgetLineItem = await this.service.update(input);
    return { budgetLineItem };
  }

  @Mutation(() => BudgetLineItemDeleted, {
    description: 'Delete a budget line item',
  })
  async deleteBudgetLineItem(@IdArg() id: ID): Promise<BudgetLineItemDeleted> {
    await this.service.delete(id);
    return {};
  }
}
