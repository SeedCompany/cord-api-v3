import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  ListField,
  OptionalField,
  PaginatedList,
  Role,
  SortablePaginationInput,
} from '~/common';
import { User } from './user.dto';

@InputType()
export abstract class UserFilters {
  @OptionalField()
  readonly name?: string;

  @OptionalField()
  readonly title?: string;

  @ListField(() => Role, {
    optional: true,
    empty: 'omit',
  })
  readonly roles?: Role[];

  @OptionalField({
    description: 'Only users that are pinned/unpinned by the requesting user',
  })
  readonly pinned?: boolean;
}

@InputType()
export class UserListInput extends SortablePaginationInput<keyof User>({
  defaultSort: 'id', // TODO How to sort on name?
}) {
  @FilterField(() => UserFilters)
  readonly filter?: UserFilters;
}

@ObjectType()
export class UserListOutput extends PaginatedList(User) {}
