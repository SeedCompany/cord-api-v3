import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ID,
  Order,
  PaginatedList,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { Unavailability } from './unavailability.dto';

@InputType()
export abstract class UnavailabilityFilters {
  readonly userId?: ID;
}

@InputType()
export class UnavailabilityListInput extends SortablePaginationInput<
  keyof Unavailability
>({
  defaultSort: 'start',
  defaultOrder: Order.DESC,
}) {
  @FilterField(UnavailabilityFilters, { internal: true })
  readonly filter: UnavailabilityFilters;
}

@ObjectType()
export class UnavailabilityListOutput extends PaginatedList(Unavailability) {}
@ObjectType({
  description: SecuredList.descriptionFor('unavailabilities'),
})
export abstract class SecuredUnavailabilityList extends SecuredList(
  Unavailability,
) {}
