import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  OptionalField,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { Location } from './location.dto';

@InputType()
export abstract class LocationFilters {
  @OptionalField()
  readonly name?: string;

  readonly fundingAccountId?: ID;
}

@InputType()
export class LocationListInput extends SortablePaginationInput<keyof Location>({
  defaultSort: 'name',
}) {
  @FilterField(() => LocationFilters)
  readonly filter?: LocationFilters;
}

@ObjectType()
export class LocationListOutput extends PaginatedList(Location, {
  itemsDescription: PaginatedList.itemDescriptionFor('locations'),
}) {}

@ObjectType()
export class SecuredLocationList extends SecuredList(Location, {
  itemsDescription: SecuredList.descriptionFor('locations'),
}) {}
