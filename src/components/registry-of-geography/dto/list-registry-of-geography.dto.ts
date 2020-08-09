import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { RegistryOfGeography } from './registry-of-geography.dto';

@InputType()
export abstract class RegistryOfGeographyFilters {
  @Field({
    description: 'Only registry of geographies matching this name',
    nullable: true,
  })
  readonly name?: string;
}

const defaultFilters = {};

@InputType()
export class RegistryOfGeographyListInput extends SortablePaginationInput<
  keyof RegistryOfGeography
>({
  defaultSort: 'name',
}) {
  static defaultVal = new RegistryOfGeographyListInput();

  @Field({ nullable: true })
  @Type(() => RegistryOfGeographyFilters)
  @ValidateNested()
  readonly filter: RegistryOfGeographyFilters = defaultFilters;
}

@ObjectType()
export class RegistryOfGeographyListOutput extends PaginatedList(
  RegistryOfGeography
) {}
