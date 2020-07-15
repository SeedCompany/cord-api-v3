import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { Story } from './story.dto';

@InputType()
export abstract class StoryFilters {
  @Field({
    description: 'Only stories matching this name',
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
