import { Injectable } from '@nestjs/common';
import { ID, UnsecuredDto } from '~/common';
import { Comment } from '../../../components/comments/dto';
import { NotificationService } from '../../notifications';
import { ProjectCommentNotification } from './project-comment-notification.dto';

@Injectable()
export class ProjectCommentNotificationService {
  constructor(private readonly notifications: NotificationService) {}

  async notify(
    members: ReadonlyArray<ID<'User'>>,
    comment: UnsecuredDto<Comment>,
  ) {
    await this.notifications.create(ProjectCommentNotification, members, {
      comment: comment.id,
    });
  }
}
