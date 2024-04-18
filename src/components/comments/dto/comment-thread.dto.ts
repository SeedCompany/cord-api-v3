import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  MaybeSecuredProp,
  Resource,
  ResourceRelationsShape,
  SecuredProps,
  SetUnsecuredType,
  UnsecuredDto,
} from '~/common';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { Comment } from './comment.dto';

@RegisterResource({ db: e.Comments.Thread })
@ObjectType({
  implements: [Resource],
})
export class CommentThread extends Resource {
  static readonly Props = keysOf<CommentThread>();
  static readonly SecuredProps: string[] =
    keysOf<SecuredProps<CommentThread>>();
  static readonly Relations = {
    comments: [Comment],
  } satisfies ResourceRelationsShape;
  static readonly Parent = 'dynamic';

  @Field(() => Comment)
  readonly firstComment: Comment & SetUnsecuredType<UnsecuredDto<Comment>>;
  readonly latestComment: Comment & SetUnsecuredType<UnsecuredDto<Comment>>;

  readonly parent: BaseNode;

  readonly creator: MaybeSecuredProp<ID | LinkTo<'User'>>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    CommentThread: typeof CommentThread;
  }
  interface ResourceDBMap {
    CommentThread: typeof e.Comments.Thread;
  }
}
