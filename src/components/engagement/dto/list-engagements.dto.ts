import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Field, InputType, ObjectType } from 'type-graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { Engagement, IEngagement } from './engagement.dto';

@InputType()
export abstract class EngagementFilters {
  @Field({
    description: 'Only engagements matching this type',
    nullable: true,
  })
  readonly type?: 'language' | 'internship';

  @Field({
    description: 'Only engagements matching this name',
    nullable: true,
  })
  readonly name?: string;
}

const defaultFilters = {};

@InputType()
export class EngagementListInput extends SortablePaginationInput<
  keyof Engagement
>({
  defaultSort: 'createdAt',
}) {
  static defaultVal = new EngagementListInput();

  @Field({ nullable: true })
  @Type(() => EngagementFilters)
  @ValidateNested()
  readonly filter: EngagementFilters = defaultFilters;
}

@ObjectType()
export class EngagementListOutput extends PaginatedList<
  IEngagement,
  Engagement
>(IEngagement, {
  itemsDescription: PaginatedList.itemDescriptionFor('engagements'),
}) {}
