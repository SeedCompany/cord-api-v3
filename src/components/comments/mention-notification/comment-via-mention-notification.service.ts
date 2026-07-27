import { Injectable } from '@nestjs/common';
import { type ID, type UnsecuredDto } from '~/common';
import { NotificationService } from '../../notifications';
import { type Comment } from '../dto';
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
    // Nothing to notify — skip the no-op create. (The Neo4j notification repo
    // returns undefined for an empty recipient set, which would otherwise throw
    // in NotificationService.create.)
    if (mentionees.length === 0) {
      return;
    }
    await this.notifications.create(CommentViaMentionNotification, mentionees, {
      comment: comment.id,
    });
  }
}
