import { type ID } from '~/common';
import {
  INotificationStrategy,
  type InputOf,
  type NotificationRow,
  NotificationStrategy,
} from '../../notifications';
import { CommentViaMentionNotification } from './comment-via-mention-notification.dto';

@NotificationStrategy(CommentViaMentionNotification)
export class CommentViaMentionNotificationStrategy extends INotificationStrategy<CommentViaMentionNotification> {
  override saveForDrizzle(input: InputOf<CommentViaMentionNotification>) {
    return { commentId: input.comment };
  }

  override hydrateExtraForDrizzle(row: NotificationRow) {
    return { comment: { id: row.commentId as ID<'Comment'> } };
  }
}
