import { InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { Story } from './story.dto';

@InputType()
export abstract class StoryFilters {}

@InputType()
export class StoryListInput extends SortablePaginationInput<keyof Story>({
  defaultSort: 'name',
}) {
  @FilterField(() => StoryFilters, { internal: true })
  readonly filter: StoryFilters;
}

@ObjectType()
export class StoryListOutput extends PaginatedList(Story) {}
