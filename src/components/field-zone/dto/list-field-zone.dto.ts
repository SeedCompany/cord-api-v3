import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { FieldZone } from './field-zone.dto';

@InputType()
export abstract class FieldZoneFilters {
  readonly fieldZoneId?: ID;
}

@InputType()
export class FieldZoneListInput extends SortablePaginationInput<
  keyof FieldZone
>({
  defaultSort: 'name',
}) {
  @FilterField(() => FieldZoneFilters, { internal: true })
  readonly filter: FieldZoneFilters;
}

@ObjectType()
export class FieldZoneListOutput extends PaginatedList(FieldZone, {
  itemsDescription: PaginatedList.itemDescriptionFor('field zones'),
}) {}

@ObjectType()
export class SecuredFieldZoneList extends SecuredList(FieldZone, {
  itemsDescription: SecuredList.descriptionFor('field zones'),
}) {}
