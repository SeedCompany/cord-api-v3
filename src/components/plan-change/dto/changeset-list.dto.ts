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
export abstract class ChangesetFilters {
  readonly projectId?: ID;
}

const defaultFilters = {};

@InputType()
export class ChangesetListInput extends SortablePaginationInput<
  keyof PlanChange
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new ChangesetListInput();

  @Type(() => ChangesetFilters)
  @ValidateNested()
  readonly filter: ChangesetFilters = defaultFilters;
}

@ObjectType()
export class ChangesetListOutput extends PaginatedList(PlanChange) {}

@ObjectType({
  description: SecuredList.descriptionFor('changesets'),
})
export abstract class SecuredChangesetList extends SecuredList(PlanChange) {}
