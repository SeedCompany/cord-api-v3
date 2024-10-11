import { Module } from '@nestjs/common';
import { NotificationModule } from '../../notifications';
import { CommentViaMentionNotificationResolver } from './comment-via-mention-notification.resolver';
import { CommentViaMentionNotificationStrategy } from './comment-via-mention-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [
    CommentViaMentionNotificationResolver,
    CommentViaMentionNotificationStrategy,
  ],
})
export class CommentViaMentionNotificationModule {}
