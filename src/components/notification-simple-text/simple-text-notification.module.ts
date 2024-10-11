import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications';
import { SimpleTextNotificationResolver } from './simple-text-notification.resolver';
import { SimpleTextNotificationStrategy } from './simple-text-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [SimpleTextNotificationResolver, SimpleTextNotificationStrategy],
})
export class SimpleTextNotificationModule {}
