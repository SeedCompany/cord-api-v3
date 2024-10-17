import { Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { NotificationRepository as EdgeDBRepository } from './notification.edgedb.repository';
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
    splitDb(Neo4jRepository, EdgeDBRepository),
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
