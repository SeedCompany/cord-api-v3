import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { User } from './user.dto';

@InputType()
export class UserListInput extends SortablePaginationInput<keyof User>({
  defaultSort: 'id', // TODO How to sort on name?
}) {
  static defaultVal = new UserListInput();
}

@ObjectType()
export class UserListOutput extends PaginatedList(User) {}
