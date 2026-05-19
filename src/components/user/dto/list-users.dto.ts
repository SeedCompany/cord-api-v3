import { InputType, ObjectType } from '@nestjs/graphql';
import {
  FilterField,
  type ID,
  IdField,
  ListField,
  OptionalField,
  PaginatedList,
  Role,
  SecuredList,
  SortablePaginationInput,
} from '~/common';
import { UserStatus } from './user-status.enum';
import { User } from './user.dto';

@InputType()
export abstract class UserFilters {
  @IdField({ optional: true })
  readonly id?: ID<'User'>;

  readonly partnerId?: ID<'Partner'>;

  @OptionalField()
  readonly name?: string;

  @OptionalField()
  readonly title?: string;

  @OptionalField(() => UserStatus)
  readonly status?: UserStatus;

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
export class UserListInput extends SortablePaginationInput<
  keyof User | 'fullName'
>({
  defaultSort: 'id',
}) {
  @FilterField(() => UserFilters)
  readonly filter?: UserFilters;
}

@ObjectType()
export class UserListOutput extends PaginatedList(User) {}

@ObjectType({
  description: SecuredList.descriptionFor('users'),
})
export abstract class SecuredUserList extends SecuredList(User) {}
