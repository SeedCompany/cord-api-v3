import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { PublicLocation } from './public-location.dto';

@InputType()
export abstract class PublicLocationFilters {
  @Field({ nullable: true })
  readonly id?: string;
}

const defaultFilters = {};

@InputType()
export class PublicLocationListInput extends SortablePaginationInput<
  keyof PublicLocation
>({
  defaultSort: 'id',
}) {
  static defaultVal = new PublicLocationListInput();

  @Field({ nullable: true })
  @Type(() => PublicLocationFilters)
  @ValidateNested()
  readonly filter: PublicLocationFilters = defaultFilters;
}

@ObjectType()
export class PublicLocationListOutput extends PaginatedList(PublicLocation) {}
