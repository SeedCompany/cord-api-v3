import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Location } from './location.dto';

@InputType()
export abstract class LocationFilters {
  readonly fundingAccountId?: ID;
}

const defaultFilters = {};

@InputType()
export class LocationListInput extends SortablePaginationInput<keyof Location>({
  defaultSort: 'name',
}) {
  @Type(() => LocationFilters)
  @ValidateNested()
  readonly filter: LocationFilters = defaultFilters;
}

@ObjectType()
export class LocationListOutput extends PaginatedList(Location, {
  itemsDescription: PaginatedList.itemDescriptionFor('locations'),
}) {}

@ObjectType()
export class SecuredLocationList extends SecuredList(Location, {
  itemsDescription: SecuredList.descriptionFor('locations'),
}) {}
