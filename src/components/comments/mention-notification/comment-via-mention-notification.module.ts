import { Module } from '@nestjs/common';
import { NotificationModule } from '../../notifications';
import { CommentViaMentionNotificationResolver } from './comment-via-mention-notification.resolver';
import { CommentViaMentionNotificationService } from './comment-via-mention-notification.service';
import { CommentViaMentionNotificationStrategy } from './comment-via-mention-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [
    CommentViaMentionNotificationResolver,
    CommentViaMentionNotificationStrategy,
    CommentViaMentionNotificationService,
  ],
  exports: [CommentViaMentionNotificationService],
})
export class CommentViaMentionNotificationModule {}
