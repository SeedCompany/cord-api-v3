import { Injectable } from '@nestjs/common';
import { ID, UnsecuredDto } from '~/common';
import { NotificationService } from '../../notifications';
import { Comment } from '../dto';
import { CommentViaMentionNotification } from './comment-via-mention-notification.dto';

@Injectable()
export class CommentViaMentionNotificationService {
  constructor(private readonly notifications: NotificationService) {}

  extract(_comment: UnsecuredDto<Comment>): ReadonlyArray<ID<'User'>> {
    return []; // TODO
  }

  async notify(
    mentionees: ReadonlyArray<ID<'User'>>,
    comment: UnsecuredDto<Comment>,
  ) {
    await this.notifications.create(CommentViaMentionNotification, mentionees, {
      comment: comment.id,
    });
  }
}
