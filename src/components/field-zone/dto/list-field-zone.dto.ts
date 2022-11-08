import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { FieldZone } from './field-zone.dto';

@InputType()
export abstract class FieldZoneFilters {
  readonly fieldZoneId?: ID;
}

const defaultFilters = {};

@InputType()
export class FieldZoneListInput extends SortablePaginationInput<
  keyof FieldZone
>({
  defaultSort: 'name',
}) {
  @Type(() => FieldZoneFilters)
  @ValidateNested()
  readonly filter: FieldZoneFilters = defaultFilters;
}

@ObjectType()
export class FieldZoneListOutput extends PaginatedList(FieldZone, {
  itemsDescription: PaginatedList.itemDescriptionFor('field zones'),
}) {}

@ObjectType()
export class SecuredFieldZoneList extends SecuredList(FieldZone, {
  itemsDescription: SecuredList.descriptionFor('field zones'),
}) {}
