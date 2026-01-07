import { Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql';
import { WebhookChannelRepository } from './channels/webhook-channel.repository';
import { WebhookChannelService } from './channels/webhook-channel.service';
import { WebhookExecutor } from './executor/webhook.executor';
import { WebhookManagementResolver } from './management/webhook-management.resolver';
import { WebhookManagementService } from './management/webhook-management.service';
import { WebhooksRepository } from './management/webhooks.repository';
import { WebhookValidator } from './webhook.validator';

@Module({
  imports: [GraphqlModule],
  providers: [
    WebhookManagementResolver,
    WebhookManagementService,
    WebhookValidator,
    WebhookExecutor,
    WebhookChannelService,
    WebhooksRepository,
    WebhookChannelRepository,
  ],
})
export class WebhooksModule {}
