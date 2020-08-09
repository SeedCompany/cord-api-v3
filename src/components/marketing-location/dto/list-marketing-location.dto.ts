import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { MarketingLocation } from './marketing-location.dto';

@InputType()
export abstract class MarketingLocationFilters {
  @Field({
    description: 'Only marketing locations matching this name',
    nullable: true,
  })
  readonly name?: string;
}

const defaultFilters = {};

@InputType()
export class MarketingLocationListInput extends SortablePaginationInput<
  keyof MarketingLocation
>({
  defaultSort: 'name',
}) {
  static defaultVal = new MarketingLocationListInput();

  @Field({ nullable: true })
  @Type(() => MarketingLocationFilters)
  @ValidateNested()
  readonly filter: MarketingLocationFilters = defaultFilters;
}

@ObjectType()
export class MarketingLocationListOutput extends PaginatedList(
  MarketingLocation
) {}
