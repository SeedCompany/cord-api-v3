import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications';
import { SystemNotificationResolver } from './system-notification.resolver';
import { SystemNotificationStrategy } from './system-notification.strategy';

@Module({
  imports: [NotificationModule],
  providers: [SystemNotificationResolver, SystemNotificationStrategy],
})
export class SystemNotificationModule {}
