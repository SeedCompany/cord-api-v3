import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { ToolFilters } from '../../tool/dto';
import { ToolUsage } from './tool-usage.dto';

@InputType()
export abstract class ToolUsageFilters {
  @FilterField(() => ToolFilters)
  readonly tool?: ToolFilters & {};
}

@InputType()
export class ToolUsageListInput extends SortablePaginationInput<
  keyof ToolUsage
>({
  defaultSort: 'createdAt',
}) {
  @FilterField(() => ToolUsageFilters)
  readonly filter?: ToolUsageFilters;
}

@ObjectType()
export class ToolUsageListOutput extends PaginatedList(ToolUsage) {}

@ObjectType({
  description: SecuredList.descriptionFor('tool usages'),
})
export abstract class SecuredToolUsageList extends SecuredList(ToolUsage) {}
