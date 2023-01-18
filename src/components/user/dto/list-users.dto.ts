import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { FilterField, PaginatedList, SortablePaginationInput } from '~/common';
import { User } from './user.dto';

@InputType()
export abstract class UserFilters {
  @Field({
    description: 'Only users that are pinned/unpinned by the requesting user',
    nullable: true,
  })
  readonly pinned?: boolean;
}

@InputType()
export class UserListInput extends SortablePaginationInput<keyof User>({
  defaultSort: 'id', // TODO How to sort on name?
}) {
  @FilterField(UserFilters)
  readonly filter: UserFilters;
}

@ObjectType()
export class UserListOutput extends PaginatedList(User) {}
