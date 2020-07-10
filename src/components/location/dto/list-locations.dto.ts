import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../common';
import { Location } from './location.dto';

@InputType()
export abstract class LocationFilters {
  @Field({
    description: 'Only locations matching this name',
    nullable: true,
  })
  readonly name?: string;

  @Field(() => [String], {
    description: 'Filter to only these types of locations',
  })
  readonly types?: Array<'country' | 'region' | 'zone'>;

  // User IDs ANY of which must be directors of the locations
  readonly userIds?: string[];
}

const defaultFilters = {};

@InputType()
export class LocationListInput extends SortablePaginationInput<keyof Location>({
  defaultSort: 'name',
}) {
  static defaultVal = new LocationListInput();

  @Field({ nullable: true })
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
