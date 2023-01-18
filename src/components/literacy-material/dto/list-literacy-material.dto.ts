import { InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { LiteracyMaterial } from './literacy-material.dto';

@InputType()
export abstract class LiteracyMaterialFilters {}

@InputType()
export class LiteracyMaterialListInput extends SortablePaginationInput<
  keyof LiteracyMaterial
>({
  defaultSort: 'name',
}) {
  @FilterField(LiteracyMaterialFilters, { internal: true })
  readonly filter: LiteracyMaterialFilters;
}

@ObjectType()
export class LiteracyMaterialListOutput extends PaginatedList(
  LiteracyMaterial
) {}
