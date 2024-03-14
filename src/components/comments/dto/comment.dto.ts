import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  DateTimeField,
  ID,
  Resource,
  SecuredProps,
  SecuredRichText,
} from '../../../common';

@RegisterResource({ db: e.Comments.Comment })
@ObjectType({
  implements: [Resource],
})
export class Comment extends Resource {
  static readonly Props = keysOf<Comment>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Comment>>();
  static readonly Parent = import('./comment-thread.dto').then(
    (m) => m.CommentThread,
  );

  readonly thread: ID;

  readonly creator: ID;

  @Field()
  readonly body: SecuredRichText;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Comment: typeof Comment;
  }
  interface ResourceDBMap {
    Comment: typeof e.Comments.Comment;
  }
}
