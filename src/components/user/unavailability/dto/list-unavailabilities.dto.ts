import { InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  ID,
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Unavailability } from './unavailability.dto';

@InputType()
export abstract class UnavailabilityFilters {
  readonly userId?: ID;
}

const defaultFilters = {};

@InputType()
export class UnavailabilityListInput extends SortablePaginationInput<
  keyof Unavailability
>({
  defaultSort: 'start',
  defaultOrder: Order.DESC,
}) {
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
  Unavailability
) {}
