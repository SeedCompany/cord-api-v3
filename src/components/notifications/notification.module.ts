import { Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { UserModule } from '../user/user.module';
import { NotificationDeliveryQueue } from './notification-delivery.queue';
import { NotificationDeliveryWorker } from './notification-delivery.worker';
import { NotificationRepository as GelRepository } from './notification.gel.repository';
import { NotificationRepository as Neo4jRepository } from './notification.repository';
import { NotificationResolver } from './notification.resolver';
import {
  NotificationService,
  NotificationServiceImpl,
} from './notification.service';
import { NotificationPreferencesModule } from './preferences/notification-preferences.module';

@Module({
  imports: [
    NotificationPreferencesModule,
    UserModule,
    NotificationDeliveryQueue.register(),
  ],
  providers: [
    NotificationResolver,
    { provide: NotificationService, useExisting: NotificationServiceImpl },
    NotificationServiceImpl,
    NotificationDeliveryWorker,
    splitDb(Neo4jRepository, { gel: GelRepository }),
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
