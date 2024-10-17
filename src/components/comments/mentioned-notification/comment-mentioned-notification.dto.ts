import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { e } from '~/core/edgedb';
import { LinkTo, RegisterResource } from '~/core/resources';
import { Notification } from '../../notifications';

@RegisterResource({ db: e.Notification.CommentMentioned })
@ObjectType({
  implements: [Notification],
})
export class CommentMentionedNotification extends Notification {
  static readonly Props = keysOf<CommentMentionedNotification>();
  static readonly SecuredProps =
    keysOf<SecuredProps<CommentMentionedNotification>>();

  readonly comment: LinkTo<'Comment'>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    CommentMentionedNotification: typeof CommentMentionedNotification;
  }
  interface ResourceDBMap {
    CommentMentionedNotification: typeof e.Notification.CommentMentioned;
  }
}
