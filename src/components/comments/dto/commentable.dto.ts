import { InterfaceType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, ResourceRelationsShape, SecuredProps } from '~/common';
import { RegisterResource } from '~/core/resources';
import { CommentThread } from './comment-thread.dto';

@RegisterResource()
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

declare module '~/core/resources/map' {
  interface ResourceMap {
    Commentable: typeof Commentable;
  }
}
