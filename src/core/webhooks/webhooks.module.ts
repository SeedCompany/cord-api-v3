import { Inject, Module } from '@nestjs/common';
import { DateTime } from 'luxon';
import { SubscriptionChannelVersion } from '../../subscription-channel-version';
import { MigrationRegistry } from '../database/migration/migration.registry';
import { GraphqlModule } from '../graphql';
import { WebhookChannelSyncMigration } from './channels/channel-sync.migration';
import { WebhookChannelRepository } from './channels/webhook-channel.repository';
import { WebhookChannelService } from './channels/webhook-channel.service';
import { WebhookDeliveryQueue } from './delivery/webhook-delivery.queue';
import { WebhookDeliveryWorker } from './delivery/webhook-delivery.worker';
import { WebhookSender } from './delivery/webhook.sender';
import { GraphqlDocumentScalar } from './dto/graphql-document.scalar';
import { WebhookExecutor } from './executor/webhook.executor';
import { WebhookManagementResolver } from './management/webhook-management.resolver';
import { WebhookManagementService } from './management/webhook-management.service';
import { WebhooksRepository } from './management/webhooks.repository';
import { WebhookProcessorQueue } from './processor/webhook-processor.queue';
import { WebhookProcessorWorker } from './processor/webhook-processor.worker';
import { WebhookListener } from './processor/webhook.listener';
import { WebhookValidator } from './webhook.validator';

@Module({
  imports: [
    GraphqlModule,
    WebhookProcessorQueue.register(),
    WebhookDeliveryQueue.register(),
  ],
  providers: [
    WebhookManagementResolver,
    GraphqlDocumentScalar,
    WebhookManagementService,
    WebhookValidator,
    WebhookExecutor,
    WebhookChannelService,
    WebhookListener,
    WebhookProcessorWorker,
    WebhookDeliveryWorker,
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
