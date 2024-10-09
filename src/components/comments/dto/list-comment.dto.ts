import { InputType, ObjectType } from '@nestjs/graphql';
import { Order, SecuredList, SortablePaginationInput } from '~/common';
import { Comment } from './comment.dto';

@InputType()
export class CommentListInput extends SortablePaginationInput<keyof Comment>({
  defaultSort: 'createdAt',
  defaultOrder: Order.DESC,
}) {}

@ObjectType()
export abstract class CommentList extends SecuredList(Comment) {}
