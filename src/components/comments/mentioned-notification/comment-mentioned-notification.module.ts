import { Module } from '@nestjs/common';
import { NotificationModule } from '../../notifications';
import { CommentMentionedNotificationResolver } from './comment-mentioned-notification.resolver';
import { CommentMentionedNotificationStrategy } from './comment-mentioned-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [
    CommentMentionedNotificationResolver,
    CommentMentionedNotificationStrategy,
  ],
})
export class CommentMentionedNotificationModule {}
