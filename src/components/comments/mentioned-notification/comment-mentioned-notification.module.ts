import { Module } from '@nestjs/common';
import { NotificationModule } from '../../notifications';
import { CommentMentionedNotificationResolver } from './comment-mentioned-notification.resolver';
import { CommentMentionedNotificationService } from './comment-mentioned-notification.service';
import { CommentMentionedNotificationStrategy } from './comment-mentioned-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [
    CommentMentionedNotificationResolver,
    CommentMentionedNotificationStrategy,
    CommentMentionedNotificationService,
  ],
  exports: [CommentMentionedNotificationService],
})
export class CommentMentionedNotificationModule {}
