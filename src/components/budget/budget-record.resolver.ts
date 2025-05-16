import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { OrganizationLoader } from '../organization';
import { SecuredOrganization } from '../organization/dto';
import { BudgetService } from './budget.service';
import {
  BudgetRecord,
  UpdateBudgetRecordInput,
  UpdateBudgetRecordOutput,
} from './dto';

@Resolver(BudgetRecord)
export class BudgetRecordResolver {
  constructor(private readonly service: BudgetService) {}

  @ResolveField(() => SecuredOrganization)
  async organization(
    @Parent() record: BudgetRecord,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(record.organization, (id) =>
      organizations.load(id),
    );
  }

  @Mutation(() => UpdateBudgetRecordOutput, {
    description: 'Update a budgetRecord',
  })
  async updateBudgetRecord(
    @Args('input') { budgetRecord: input, changeset }: UpdateBudgetRecordInput,
  ): Promise<UpdateBudgetRecordOutput> {
    const budgetRecord = await this.service.updateRecord(input, changeset);
    return { budgetRecord };
  }
}
