import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { FieldRegion } from './field-region.dto';

@InputType()
export abstract class FieldRegionFilters {
  readonly fieldZoneId?: ID;
}

@InputType()
export class FieldRegionListInput extends SortablePaginationInput<
  keyof FieldRegion
>({
  defaultSort: 'name',
}) {
  @FilterField(() => FieldRegionFilters, { internal: true })
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
