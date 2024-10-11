import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { LinkTo } from '~/core/resources';
import { Notification } from '../../notifications';

@ObjectType({
  implements: [Notification],
})
export class CommentMentionedNotification extends Notification {
  static readonly Props = keysOf<CommentMentionedNotification>();
  static readonly SecuredProps =
    keysOf<SecuredProps<CommentMentionedNotification>>();

  readonly comment: LinkTo<'Comment'>;
}
