import { Module } from '@nestjs/common';
import { SubscriptionChannelVersion } from '../../subscription-channel-version';
import { GraphqlModule } from '../graphql';
import { WebhookChannelSync } from './channels/webhook-channel-sync.service';
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
    WebhookChannelSync,
    {
      provide: SubscriptionChannelVersion.TOKEN,
      useValue: SubscriptionChannelVersion,
    },
  ],
})
export class WebhooksModule {}
