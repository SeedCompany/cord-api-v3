import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  Resource,
  SecuredProps,
  SetUnsecuredType,
  UnsecuredDto,
} from '~/common';
import { BaseNode } from '~/core/database/results';
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
  static readonly Parent = 'dynamic';

  @Field(() => Comment)
  readonly firstComment: Comment & SetUnsecuredType<UnsecuredDto<Comment>>;
  readonly latestComment: Comment & SetUnsecuredType<UnsecuredDto<Comment>>;

  readonly parent: BaseNode;

  readonly creator: ID;
}
