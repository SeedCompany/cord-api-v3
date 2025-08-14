import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  OptionalField,
  PaginatedList,
  SortablePaginationInput,
} from '~/common';
import { Tool } from './tool.dto';

@InputType()
export abstract class ToolFilters {
  @OptionalField()
  readonly name?: string;
}

@InputType()
export class ToolListInput extends SortablePaginationInput<keyof Tool>({
  defaultSort: 'name',
}) {
  @FilterField(() => ToolFilters)
  readonly filter?: ToolFilters;
}

@ObjectType()
export class ToolListOutput extends PaginatedList(Tool) {}
