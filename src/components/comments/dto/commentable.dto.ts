import { InterfaceType } from '@nestjs/graphql';
import { Resource, type ResourceRelationsShape } from '~/common';
import { RegisterResource } from '~/core/resources';
import { CommentThread } from './comment-thread.dto';

@RegisterResource()
@InterfaceType({
  description: 'A resource that can be commented on',
  implements: [Resource],
})
export abstract class Commentable extends Resource {
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    commentThreads: [CommentThread],
  })) satisfies ResourceRelationsShape;

  declare __typename: string;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Commentable: typeof Commentable;
  }
}
