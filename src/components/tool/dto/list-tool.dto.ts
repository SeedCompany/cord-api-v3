import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  OptionalField,
  PaginatedList,
  SecuredList,
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
  @FilterField(() => ToolFilters, { internal: true })
  readonly filter?: ToolFilters;
}

@ObjectType()
export class ToolListOutput extends PaginatedList(Tool) {}

@ObjectType({
  description: SecuredList.descriptionFor('tools'),
})
export abstract class SecuredToolList extends SecuredList(Tool) {}
