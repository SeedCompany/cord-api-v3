import { ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, SecuredProps } from '~/common';
import { LinkTo } from '~/core/resources';
import { Notification } from '../../notifications';

@ObjectType({
  implements: [Notification],
})
export class CommentMentionedNotification extends Notification {
  static readonly Input: { comment: ID<'Comment'> } = undefined as any;
  static readonly Props = keysOf<CommentMentionedNotification>();
  static readonly SecuredProps =
    keysOf<SecuredProps<CommentMentionedNotification>>();

  readonly comment: LinkTo<'Comment'>;

  readonly commentable: LinkTo<'Commentable'>;
}
