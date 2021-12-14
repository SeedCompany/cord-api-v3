import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { PaginatedList, SortablePaginationInput } from '../../../common';
import { User } from './user.dto';

@InputType()
export abstract class UserFilters {
  @Field({
    description: 'Only users that are pinned/unpinned by the requesting user',
    nullable: true,
  })
  readonly pinned?: boolean;
}

const defaultFilters = {};

@InputType()
export class UserListInput extends SortablePaginationInput<keyof User>({
  defaultSort: 'id', // TODO How to sort on name?
}) {
  static defaultVal = new UserListInput();

  @Field({ nullable: true })
  @Type(() => UserFilters)
  @ValidateNested()
  readonly filter: UserFilters = defaultFilters;
}

@ObjectType()
export class UserListOutput extends PaginatedList(User) {}
