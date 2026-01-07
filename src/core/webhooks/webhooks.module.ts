import { Module } from '@nestjs/common';
import { GraphqlModule } from '../graphql';
import { WebhookManagementResolver } from './management/webhook-management.resolver';
import { WebhookManagementService } from './management/webhook-management.service';
import { WebhooksRepository } from './management/webhooks.repository';

@Module({
  imports: [GraphqlModule],
  providers: [
    WebhookManagementResolver,
    WebhookManagementService,
    WebhooksRepository,
  ],
})
export class WebhooksModule {}
