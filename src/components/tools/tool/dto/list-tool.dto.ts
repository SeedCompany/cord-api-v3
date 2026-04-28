import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  IdField,
  OptionalField,
  PaginatedList,
  SortablePaginationInput,
} from '~/common';
import { Tool } from './tool.dto';

@InputType()
export abstract class ToolFilters {
  @IdField({ optional: true })
  readonly id?: ID<'Tool'>;

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
