import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  IdField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { UserFilters } from '../../user/dto';
import { FieldZone } from './field-zone.dto';

@InputType()
export abstract class FieldZoneFilters {
  @IdField({ optional: true })
  readonly id?: ID<'FieldZone'>;

  @FilterField(() => UserFilters)
  readonly director?: UserFilters & {};
}

@InputType()
export class FieldZoneListInput extends SortablePaginationInput<
  keyof FieldZone
>({
  defaultSort: 'name',
}) {
  @FilterField(() => FieldZoneFilters)
  readonly filter?: FieldZoneFilters;
}

@ObjectType()
export class FieldZoneListOutput extends PaginatedList(FieldZone, {
  itemsDescription: PaginatedList.itemDescriptionFor('field zones'),
}) {}

@ObjectType()
export class SecuredFieldZoneList extends SecuredList(FieldZone, {
  itemsDescription: SecuredList.descriptionFor('field zones'),
}) {}
