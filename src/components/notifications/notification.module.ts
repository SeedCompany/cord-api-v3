import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { NotificationRepository as GelRepository } from './notification.gel.repository';
import { NotificationRepository as Neo4jRepository } from './notification.repository';
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
    splitDb(Neo4jRepository, GelRepository),
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
