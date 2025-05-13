import { Field, ObjectType } from '@nestjs/graphql';
import {
  type ID,
  Resource,
  type ResourceRelationsShape,
  type SetUnsecuredType,
  type UnsecuredDto,
} from '~/common';
import { type BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { Comment } from './comment.dto';

@RegisterResource({ db: e.Comments.Thread })
@ObjectType({
  implements: [Resource],
})
export class CommentThread extends Resource {
  static readonly Relations = {
    comments: [Comment],
  } satisfies ResourceRelationsShape;
  static readonly Parent = 'dynamic';

  @Field(() => Comment)
  readonly firstComment: Comment & SetUnsecuredType<UnsecuredDto<Comment>>;
  readonly latestComment: Comment & SetUnsecuredType<UnsecuredDto<Comment>>;

  readonly parent: BaseNode;

  readonly creator: ID;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    CommentThread: typeof CommentThread;
  }
  interface ResourceDBMap {
    CommentThread: typeof e.Comments.Thread;
  }
}
