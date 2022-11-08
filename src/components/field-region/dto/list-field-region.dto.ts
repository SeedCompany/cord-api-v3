import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { FieldRegion } from './field-region.dto';

@InputType()
export abstract class FieldRegionFilters {
  readonly fieldZoneId?: ID;
}

const defaultFilters = {};

@InputType()
export class FieldRegionListInput extends SortablePaginationInput<
  keyof FieldRegion
>({
  defaultSort: 'name',
}) {
  @Type(() => FieldRegionFilters)
  @ValidateNested()
  readonly filter: FieldRegionFilters = defaultFilters;
}

@ObjectType()
export class FieldRegionListOutput extends PaginatedList(FieldRegion, {
  itemsDescription: PaginatedList.itemDescriptionFor('field regions'),
}) {}

@ObjectType()
export class SecuredFieldRegionList extends SecuredList(FieldRegion, {
  itemsDescription: SecuredList.descriptionFor('field regions'),
}) {}
