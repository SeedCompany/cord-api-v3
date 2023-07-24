import { InterfaceType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, ResourceRelationsShape, SecuredProps } from '~/common';
import { CommentThread } from './comment-thread.dto';

@InterfaceType({
  description: 'A resource that can be commented on',
  implements: [Resource],
})
export abstract class Commentable extends Resource {
  static readonly Props: string[] = keysOf<Commentable>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Commentable>>();
  static readonly Relations = {
    commentThreads: [CommentThread],
  } satisfies ResourceRelationsShape;

  declare __typename: string;
}
