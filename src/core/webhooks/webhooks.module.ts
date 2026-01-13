import { Inject, Module } from '@nestjs/common';
import { DateTime } from 'luxon';
import { SubscriptionChannelVersion } from '../../subscription-channel-version';
import { MigrationRegistry } from '../database/migration/migration.registry';
import { GraphqlModule } from '../graphql';
import { WebhookChannelSyncMigration } from './channels/channel-sync.migration';
import { WebhookChannelRepository } from './channels/webhook-channel.repository';
import { WebhookChannelService } from './channels/webhook-channel.service';
import { WebhookExecutor } from './executor/webhook.executor';
import { WebhookManagementResolver } from './management/webhook-management.resolver';
import { WebhookManagementService } from './management/webhook-management.service';
import { WebhooksRepository } from './management/webhooks.repository';
import { WebhookListener } from './webhook.listener';
import { WebhookSender } from './webhook.sender';
import { WebhookValidator } from './webhook.validator';

@Module({
  imports: [GraphqlModule],
  providers: [
    WebhookManagementResolver,
    WebhookManagementService,
    WebhookValidator,
    WebhookListener,
    WebhookExecutor,
    WebhookChannelService,
    WebhookSender,
    WebhooksRepository,
    WebhookChannelRepository,
    WebhookChannelSyncMigration,
    {
      provide: SubscriptionChannelVersion.TOKEN,
      useValue: SubscriptionChannelVersion,
    },
  ],
})
export class WebhooksModule {
  constructor(
    registry: MigrationRegistry,
    migration: WebhookChannelSyncMigration,
    @Inject(SubscriptionChannelVersion.TOKEN) version: DateTime,
  ) {
    registry.register(migration, version);
  }
}
