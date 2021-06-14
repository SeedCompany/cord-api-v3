import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { PlanChange } from './plan-change.dto';

@InputType()
export abstract class PlanChangeFilters {
  readonly projectId?: ID;
}

const defaultFilters = {};

@InputType()
export class PlanChangeListInput extends SortablePaginationInput<
  keyof PlanChange
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new PlanChangeListInput();

  @Type(() => PlanChangeFilters)
  @ValidateNested()
  readonly filter: PlanChangeFilters = defaultFilters;
}

@ObjectType()
export class PlanChangeListOutput extends PaginatedList(PlanChange) {}

@ObjectType({
  description: SecuredList.descriptionFor('plan changes'),
})
export abstract class SecuredPlanChangeList extends SecuredList(PlanChange) {}
