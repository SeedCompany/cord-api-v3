import { InputType, ObjectType } from '@nestjs/graphql';
import { Order, PaginatedList, SortablePaginationInput } from '~/common';
import { OutcomeHistory } from './outcome-history.dto';

@InputType()
export class OutcomeHistoryListInput extends SortablePaginationInput<
  keyof OutcomeHistory
>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {}

@ObjectType()
export abstract class OutcomeHistoryList extends PaginatedList(
  OutcomeHistory,
) {}
