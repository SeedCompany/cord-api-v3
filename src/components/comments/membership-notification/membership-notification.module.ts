import { Module } from '@nestjs/common';
import { CommentViaMembershipNotificationStrategy } from './membership-notification.strategy';

@Module({
  providers: [CommentViaMembershipNotificationStrategy],
})
export class CommentViaMembershipNotificationModule {}
