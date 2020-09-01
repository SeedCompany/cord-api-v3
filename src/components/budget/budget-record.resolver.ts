import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { OrganizationService } from '../organization';
import { SecuredOrganization } from '../organization/dto';
import { BudgetService } from './budget.service';
import {
  BudgetRecord,
  UpdateBudgetRecordInput,
  UpdateBudgetRecordOutput,
} from './dto';

@Resolver(BudgetRecord)
export class BudgetRecordResolver {
  constructor(
    private readonly service: BudgetService,
    private readonly organizations: OrganizationService
  ) {}

  @ResolveField(() => SecuredOrganization)
  async organization(
    @Session() session: ISession,
    @Parent() record: BudgetRecord
  ): Promise<SecuredOrganization> {
    const id = record.organization.value;
    const value = id
      ? await this.organizations.readOne(id, session)
      : undefined;
    return {
      ...record.organization,
      value,
    };
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
}
