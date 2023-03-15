import { InputType, ObjectType } from '@nestjs/graphql';
import { Order, PaginatedList, SortablePaginationInput } from '~/common';
import { Outcome } from './outcome.dto';

@InputType()
export class OutcomeListInput extends SortablePaginationInput<keyof Outcome>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {}

@ObjectType()
export abstract class OutcomeList extends PaginatedList(Outcome) {}
