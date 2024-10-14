import { Module } from '@nestjs/common';
import { NotificationModule } from '../../../components/notifications';
import { ProjectCommentNotificationResolver } from './project-comment-notication.resolver';
import { ProjectCommentNotificationService } from './project-comment-notification.service';
import { ProjectCommentNotificationStrategy } from './project-comment-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [
    ProjectCommentNotificationResolver,
    ProjectCommentNotificationStrategy,
    ProjectCommentNotificationService,
  ],
})
export class ProjectCommentNotificationModule {}
