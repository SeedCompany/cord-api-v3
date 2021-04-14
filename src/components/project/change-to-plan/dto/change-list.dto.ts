import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { PlanChange } from './plan-change.dto';

@InputType()
export abstract class ChangeFilters {
  readonly projectId?: string;
}

const defaultFilters = {};

@InputType()
export class ChangeListInput extends SortablePaginationInput<keyof PlanChange>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ChangeListInput();

  @Type(() => ChangeFilters)
  @ValidateNested()
  readonly filter: ChangeFilters = defaultFilters;
}

@ObjectType()
export class ChangeListOutput extends PaginatedList(PlanChange) {}

@ObjectType({
  description: SecuredList.descriptionFor('changes'),
})
export abstract class SecuredChangeList extends SecuredList(PlanChange) {}
