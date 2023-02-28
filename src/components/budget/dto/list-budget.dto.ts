import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { BudgetRecord } from './budget-record.dto';
import { Budget } from './budget.dto';

@InputType()
export abstract class BudgetFilters {
  readonly projectId?: ID;
}

@InputType()
export class BudgetListInput extends SortablePaginationInput<keyof Budget>({
  defaultSort: 'status',
}) {
  @FilterField(BudgetFilters, { internal: true })
  readonly filter: BudgetFilters;
}

@ObjectType()
export class BudgetListOutput extends PaginatedList(Budget) {}

@ObjectType({
  description: SecuredList.descriptionFor('budget records'),
})
export abstract class SecuredBudgetList extends SecuredList(Budget) {}

@InputType()
export abstract class BudgetRecordFilters {
  readonly budgetId: ID;
}

@InputType()
export class BudgetRecordListInput extends SortablePaginationInput<
  keyof BudgetRecord
>({
  defaultSort: 'fiscalYear',
}) {
  @Type(() => BudgetRecordFilters)
  @ValidateNested()
  readonly filter: BudgetRecordFilters;
}

@ObjectType()
export class BudgetRecordListOutput extends PaginatedList(BudgetRecord) {}

@ObjectType({
  description: SecuredList.descriptionFor('budget records'),
})
export abstract class SecuredBudgetRecordList extends SecuredList(
  BudgetRecord,
) {}
