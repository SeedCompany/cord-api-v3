import { Injectable } from '@nestjs/common';
import { ID } from '~/common';
import { NotificationService } from '../../notifications';
import { ProjectCommentNotification } from './project-comment-notification.dto';

@Injectable()
export class ProjectCommentNotificationService {
  constructor(private readonly notifications: NotificationService) {}

  async notify(
    members: ReadonlyArray<ID<'User'>> | [],
    commentId: ID<'Comment'>,
    projectId: ID<'Project'>,
  ) {
    await this.notifications.create(ProjectCommentNotification, members, {
      comment: commentId,
      project: projectId,
    });
  }
}
