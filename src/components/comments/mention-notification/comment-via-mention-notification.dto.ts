import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { LinkTo } from '~/core/resources';
import { Notification } from '../../notifications';

@ObjectType({
  implements: [Notification],
})
export class CommentViaMentionNotification extends Notification {
  static readonly Props = keysOf<CommentViaMentionNotification>();
  static readonly SecuredProps =
    keysOf<SecuredProps<CommentViaMentionNotification>>();

  readonly comment: LinkTo<'Comment'>;
}
