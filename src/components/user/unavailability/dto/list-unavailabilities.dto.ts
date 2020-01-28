import { InputType, ObjectType } from 'type-graphql';
import {
  Order,
  SecuredList,
  SortablePaginationInput,
} from '../../../../common';
import { Unavailability } from './unavailability.dto';

@InputType()
export class UnavailabilityListInput extends SortablePaginationInput<
  keyof Unavailability
>({
  defaultSort: 'start',
  defaultOrder: Order.DESC,
}) {
  static defaultVal = new UnavailabilityListInput();
}

@ObjectType({
  description: SecuredList.descriptionFor('unavailabilities'),
})
export abstract class SecuredUnavailabilityList extends SecuredList(
  Unavailability,
) {}
