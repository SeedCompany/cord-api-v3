import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Budget, BudgetRecord } from './budget';

@InputType()
export abstract class BudgetFilters {
  @Field(() => ID, {
    description: 'Only budgets matching this projectId',
    nullable: true,
  })
  readonly projectId?: string;
}

const defaultFilters = {};

@InputType()
export class BudgetListInput extends SortablePaginationInput<keyof Budget>({
  defaultSort: 'status',
}) {
  static defaultVal = new BudgetListInput();

  @Field({ nullable: true })
  @Type(() => BudgetFilters)
  @ValidateNested()
  readonly filter: BudgetFilters = defaultFilters;
}

@ObjectType()
export class BudgetListOutput extends PaginatedList(Budget) {}

@ObjectType({
  description: SecuredList.descriptionFor('budget records'),
})
export abstract class SecuredBudgetList extends SecuredList(Budget) {}

@InputType()
export abstract class BudgetRecordFilters {
  @Field(() => ID, {
    description: 'Only budget records matching this fiscalYEar',
    nullable: true,
  })
  readonly fiscalYear?: string;

  @Field({
    description: 'Only budget records matching this org',
    nullable: true,
  })
  readonly organizationId?: string;
}

@InputType()
export class BudgetRecordListInput extends SortablePaginationInput<
  keyof BudgetRecord
>({
  defaultSort: 'fiscalYear',
}) {
  static defaultVal = new BudgetListInput();

  @Field({ nullable: true })
  @Type(() => BudgetRecordFilters)
  @ValidateNested()
  readonly filter: BudgetRecordFilters = defaultFilters;
}

@ObjectType()
export class BudgetRecordListOutput extends PaginatedList(
  BudgetRecord as any
) {}

@ObjectType({
  description: SecuredList.descriptionFor('budget records'),
})
export abstract class SecuredBudgetRecordList extends SecuredList(
  BudgetRecord
) {}
