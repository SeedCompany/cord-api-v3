import { Field, InputType, ObjectType } from 'type-graphql';
import {
  PaginatedList,
  Order,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';

import { Type } from 'class-transformer';
import { Unavailability } from './unavailability.dto';
import { ValidateNested } from 'class-validator';

@InputType()
export abstract class UnavailabilityFilters {
  @Field({
    description: 'Only unavailability matching this name',
    nullable: true,
  })
  readonly userId?: string;
}

const defaultFilters = {};

@InputType()
export class UnavailabilityListInput extends SortablePaginationInput<keyof Unavailability>({
  defaultSort: 'start',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new UnavailabilityListInput();

  @Field({ nullable: true })
  @Type(() => UnavailabilityFilters)
  @ValidateNested()
  readonly filter: UnavailabilityFilters = defaultFilters;
}

@ObjectType()
export class UnavailabilityListOutput extends PaginatedList(Unavailability) {}
@ObjectType({
  description: SecuredList.descriptionFor('unavailabilities'),
})
export abstract class SecuredUnavailabilityList extends SecuredList(
  Unavailability,
) {}
