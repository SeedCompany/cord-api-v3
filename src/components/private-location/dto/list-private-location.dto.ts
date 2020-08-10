import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { PrivateLocation } from './private-location.dto';

@InputType()
export abstract class PrivateLocationFilters {
  @Field({ nullable: true })
  readonly name?: string;

  @Field({ nullable: true })
  readonly publicName?: string;
}

const defaultFilters = {};

@InputType()
export class PrivateLocationListInput extends SortablePaginationInput<
  keyof PrivateLocation
>({
  defaultSort: 'name',
}) {
  static defaultVal = new PrivateLocationListInput();

  @Field({ nullable: true })
  @Type(() => PrivateLocationFilters)
  @ValidateNested()
  readonly filter: PrivateLocationFilters = defaultFilters;
}

@ObjectType()
export class PrivateLocationListOutput extends PaginatedList(PrivateLocation) {}
