import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  Resource,
  ResourceRelationsShape,
  SecuredProps,
  SetUnsecuredType,
  UnsecuredDto,
} from '~/common';
import { RegisterResource } from '~/core';
import { BaseNode } from '~/core/database/results';
import { Comment } from './comment.dto';

@RegisterResource()
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

  readonly creator: ID;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    CommentThread: typeof CommentThread;
  }
}
