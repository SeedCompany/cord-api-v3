import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { type SecuredProps } from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Notification } from '../../notifications';

@RegisterResource({ db: e.Notification.CommentViaMention })
@ObjectType({
  implements: [Notification],
})
export class CommentViaMentionNotification extends Notification {
  static readonly Props = keysOf<CommentViaMentionNotification>();
  static readonly SecuredProps =
    keysOf<SecuredProps<CommentViaMentionNotification>>();

  readonly comment: LinkTo<'Comment'>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    CommentMentionedNotification: typeof CommentViaMentionNotification;
  }
  interface ResourceDBMap {
    CommentMentionedNotification: typeof e.Notification.CommentViaMention;
  }
}
