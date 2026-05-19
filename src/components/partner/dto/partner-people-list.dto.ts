import { InputType } from '@nestjs/graphql';
import { FilterField, SortablePaginationInput } from '~/common';
import { type User, UserFilters } from '../../user/dto';

@InputType()
export class PartnerPeopleListInput extends SortablePaginationInput<
  keyof User | 'fullName'
>({
  defaultSort: 'fullName',
}) {
  @FilterField(() => UserFilters)
  readonly filter?: UserFilters & {};
}
