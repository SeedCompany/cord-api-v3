import { Module } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { NotificationResolver } from './notification.resolver';
import {
  NotificationService,
  NotificationServiceImpl,
} from './notification.service';

@Module({
  providers: [
    NotificationResolver,
    { provide: NotificationService, useExisting: NotificationServiceImpl },
    NotificationServiceImpl,
    NotificationRepository,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
