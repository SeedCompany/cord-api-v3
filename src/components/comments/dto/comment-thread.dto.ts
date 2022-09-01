import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { BaseNode } from '~/core/database/results';
import { ID, Resource, SecuredProps } from '../../../common';
import { Comment } from './comment.dto';

@ObjectType({
  implements: [Resource],
})
export class CommentThread extends Resource {
  static readonly Props = keysOf<CommentThread>();
  static readonly SecuredProps: string[] =
    keysOf<SecuredProps<CommentThread>>();
  static readonly Relations = {
    comments: [Comment],
  };

  @Field()
  readonly firstComment: Comment;
  readonly latestComment: Comment;

  readonly parent: BaseNode;

  readonly creator: ID;
}
