import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Story } from './story';

@InputType()
export abstract class StoryFilters {
  @Field({
    description: 'Only story matching this name',
    nullable: true,
  })
  readonly name?: string;
}

const defaultFilters = {};

@InputType()
export class StoryListInput extends SortablePaginationInput<keyof Story>({
  defaultSort: 'name',
}) {
  static defaultVal = new StoryListInput();

  @Field({ nullable: true })
  @Type(() => StoryFilters)
  @ValidateNested()
  readonly filter: StoryFilters = defaultFilters;
}

@ObjectType()
export class StoryListOutput extends PaginatedList(Story) {}

@ObjectType({
  description: SecuredList.descriptionFor('storys'),
})
export abstract class SecuredStoryList extends SecuredList(Story) {}
