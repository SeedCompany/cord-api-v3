import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { LiteracyMaterial } from './literacy-material.dto';

@InputType()
export abstract class LiteracyMaterialFilters {}

const defaultFilters = {};

@InputType()
export class LiteracyMaterialListInput extends SortablePaginationInput<
  keyof LiteracyMaterial
>({
  defaultSort: 'name',
}) {
  @Type(() => LiteracyMaterialFilters)
  @ValidateNested()
  readonly filter: LiteracyMaterialFilters = defaultFilters;
}

@ObjectType()
export class LiteracyMaterialListOutput extends PaginatedList(
  LiteracyMaterial
) {}
