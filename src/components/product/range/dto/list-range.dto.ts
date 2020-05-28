import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Range } from './range';

@InputType()
export abstract class RangeFilters {
  @Field({
    description: 'Only Range matching this range',
    nullable: true,
  })
  readonly id?: string;
}

const defaultFilters = {};

@InputType()
export class RangeListInput extends SortablePaginationInput<keyof Range>({
  defaultSort: 'start',
}) {
  static defaultVal = new RangeListInput();

  @Field({ nullable: true })
  @Type(() => RangeFilters)
  @ValidateNested()
  readonly filter: RangeFilters = defaultFilters;
}

@ObjectType()
export class RangeListOutput extends PaginatedList(Range) {}

@ObjectType({
  description: SecuredList.descriptionFor('ranges'),
})
export abstract class SecuredRangeList extends SecuredList(Range) {}
