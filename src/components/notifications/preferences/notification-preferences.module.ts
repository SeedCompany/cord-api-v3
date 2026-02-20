import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { NotificationModule } from '../notification.module';
import { NotificationPreferencesRepository as GelRepository } from './notification-preferences.gel.repository';
import { NotificationPreferencesRepository as Neo4jRepository } from './notification-preferences.repository';
import { NotificationPreferencesResolver } from './notification-preferences.resolver';
import { NotificationPreferencesService } from './notification-preferences.service';

@Module({
  imports: [forwardRef(() => NotificationModule)],
  providers: [
    NotificationPreferencesResolver,
    NotificationPreferencesService,
    splitDb(Neo4jRepository, { gel: GelRepository }),
  ],
  exports: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
