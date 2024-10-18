import { Module } from '@nestjs/common';
import { NotificationModule } from '../../../components/notifications';
import { ProjectCommentNotificationService } from './project-comment-notification.service';
import { ProjectCommentNotificationStrategy } from './project-comment-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [
    ProjectCommentNotificationStrategy,
    ProjectCommentNotificationService,
  ],
  exports: [ProjectCommentNotificationService],
})
export class ProjectCommentNotificationModule {}
