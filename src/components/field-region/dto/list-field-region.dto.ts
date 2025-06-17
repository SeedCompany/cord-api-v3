import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  IdField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { FieldZoneFilters } from '../../field-zone/dto';
import { FieldRegion } from './field-region.dto';

@InputType()
export abstract class FieldRegionFilters {
  @IdField({ optional: true })
  readonly id?: ID<'FieldRegion'>;

  @FilterField(() => FieldZoneFilters)
  readonly fieldZone?: FieldZoneFilters & {};
}

@InputType()
export class FieldRegionListInput extends SortablePaginationInput<
  keyof FieldRegion
>({
  defaultSort: 'name',
}) {
  @FilterField(() => FieldRegionFilters)
  readonly filter?: FieldRegionFilters;
}

@ObjectType()
export class FieldRegionListOutput extends PaginatedList(FieldRegion, {
  itemsDescription: PaginatedList.itemDescriptionFor('field regions'),
}) {}

@ObjectType()
export class SecuredFieldRegionList extends SecuredList(FieldRegion, {
  itemsDescription: SecuredList.descriptionFor('field regions'),
}) {}
